(function (window) {
    'use strict';

    var api = window.BirdWeatherApi;
    var calendar = window.BirdWeatherCollageDay;
    var pageSize = 100;
    var operation = 'query CollageDetections($stationIds: [ID!]!, $period: InputDuration!, $after: String) {' +
        ' detections(first: 100, stationIds: $stationIds, period: $period, after: $after) {' +
        ' nodes { id speciesId timestamp } pageInfo { hasNextPage endCursor } } }';

    function byRecency(a, b) {
        return b.latest - a.latest || (a.id < b.id ? -1 : 1);
    }

    function create(config, limit) {
        var nearby = config.source === 'nearby';
        var zone = '';
        var checkedDate = null;
        var scanDate = null;
        var displayOrder = [];

        function dateAt(time) {
            return nearby ? calendar.deviceDate(time) : calendar.stationDate(time, zone);
        }

        function checkDay(time) {
            var current = dateAt(time);
            var changed = (checkedDate !== null && checkedDate !== current) ||
                (scanDate !== null && scanDate !== current);
            checkedDate = current;
            if (changed) {
                scanDate = null;
                displayOrder = [];
            }
            return changed;
        }

        function load(complete) {
            var now = Date.now();
            scanDate = null;
            var request;
            var aborted = false;
            var counts = Object.create(null);
            var seen = Object.create(null);
            var cursors = Object.create(null);

            function finish(error, result) {
                if (!aborted) {
                    complete(error, result);
                }
            }

            function scan(ids, stationName) {
                var date = dateAt(now);
                if (!date) {
                    finish('collageZoneUnavailable');
                    return;
                }
                scanDate = date;
                var result = { date: date, stationName: stationName, hasStations: !!ids.length, species: [], dailySpecies: [], omitted: 0 };
                if (!ids.length) {
                    displayOrder = [];
                    finish(null, result);
                    return;
                }
                var period = nearby ? calendar.nearbyPeriod(now) : { from: date, to: date, timezone: zone };

                function record(node) {
                    var id = node && String(node.id);
                    var speciesId = node && String(node.speciesId);
                    var timestamp = node && node.timestamp;
                    if (!/^[1-9][0-9]{0,19}$/.test(id) || !api.validStationId(speciesId) ||
                            typeof timestamp !== 'string' ||
                            !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?(?:Z|[+-]\d\d:\d\d)$/.test(timestamp)) {
                        return false;
                    }
                    var heard = Date.parse(timestamp);
                    if (!isFinite(heard)) {
                        return false;
                    }
                    if (heard <= now && dateAt(heard) === date && !seen[id]) {
                        seen[id] = true;
                        var entry = counts[speciesId] || { id: speciesId, latest: heard, count: 0 };
                        entry.count += 1;
                        entry.latest = Math.max(entry.latest, heard);
                        counts[speciesId] = entry;
                    }
                    return true;
                }

                function finalize() {
                    var ranked = Object.keys(counts).map(function (id) { return counts[id]; });
                    if (!ranked.length) {
                        displayOrder = [];
                        finish(null, result);
                        return;
                    }
                    ranked.sort(byRecency);
                    var retained = ranked.slice(0, limit).map(function (entry) { return entry.id; });
                    var all = ranked.map(function (entry) { return entry.id; });
                    result.omitted = ranked.length - retained.length;
                    var speciesById = Object.create(null);

                    // Keep surviving species in place, then append new entrants from oldest to newest.
                    var selected = Object.create(null);
                    retained.forEach(function (id) {
                        selected[id] = true;
                    });
                    var nextOrder = displayOrder.filter(function (id) {
                        return selected[id];
                    });
                    var alreadyDisplayed = Object.create(null);
                    nextOrder.forEach(function (id) {
                        alreadyDisplayed[id] = true;
                    });
                    var entering = ranked.filter(function (entry) {
                        return selected[entry.id] && !alreadyDisplayed[entry.id];
                    });
                    entering.sort(function (a, b) {
                        return a.latest - b.latest || (a.id < b.id ? -1 : 1);
                    });
                    entering.forEach(function (entry) {
                        nextOrder.push(entry.id);
                    });

                    function loadSpecies(offset) {
                        if (aborted) {
                            return;
                        }
                        if (offset >= all.length) {
                            displayOrder = nextOrder;
                            result.dailySpecies = all.map(function (id) { return speciesById[id]; });
                            result.species = nextOrder.map(function (id) { return speciesById[id]; });
                            finish(null, result);
                            return;
                        }

                        var batch = all.slice(offset, offset + 32);
                        var nextOffset = offset + batch.length;
                        var callbackCompleted = false;
                        var currentRequest = api.speciesForIds(batch, function (error, species) {
                            callbackCompleted = true;
                            if (aborted) {
                                return;
                            }
                            if (error || !Array.isArray(species) || species.length !== batch.length) {
                                finish(error || 'unavailable');
                                return;
                            }
                            species.forEach(function (bird) {
                                speciesById[bird.id] = bird;
                            });
                            loadSpecies(nextOffset);
                        });
                        // A synchronous response may already have advanced to the next batch.
                        if (!aborted && !callbackCompleted) {
                            request = currentRequest;
                        }
                    }

                    loadSpecies(0);
                }

                function fetchPage(after) {
                    request = api.query(operation, { stationIds: ids, period: period, after: after }, function (error, data) {
                        if (aborted) {
                            return;
                        }
                        var page = !error && data.detections;
                        var info = page && page.pageInfo;
                        if (!info || typeof info.hasNextPage !== 'boolean' || !Array.isArray(page.nodes) ||
                                page.nodes.length > pageSize || !page.nodes.every(record)) {
                            finish('unavailable');
                            return;
                        }
                        if (!info.hasNextPage) {
                            finalize();
                            return;
                        }
                        var cursor = info.endCursor;
                        if (typeof cursor !== 'string' || !cursor || cursor.length > 512 || cursors[cursor]) {
                            finish('unavailable');
                            return;
                        }
                        cursors[cursor] = true;
                        fetchPage(cursor);
                    });
                }

                fetchPage(null);
            }

            if (nearby) {
                request = api.nearbyStationIds(config.coordinates, config.radius, function (error, ids) {
                    if (aborted) {
                        return;
                    }
                    if (error) {
                        finish(error);
                    } else {
                        scan(ids, '');
                    }
                });
            } else {
                request = api.collageStation(config.station, function (error, station) {
                    if (aborted) {
                        return;
                    }
                    if (error) {
                        finish(error);
                    } else if (!calendar.stationDate(now, station.timezone)) {
                        finish('collageZoneUnavailable');
                    } else {
                        zone = station.timezone;
                        scan([config.station], station.name);
                    }
                });
            }
            return { abort: function () { aborted = true; request.abort(); } };
        }

        return { load: load, checkDay: checkDay };
    }

    window.BirdWeatherCollageData = { create: create };
}(window));
