(function (window) {
    'use strict';

    var endpoint = 'https://app.birdweather.com/graphql';
    var speciesFields = 'id commonName scientificName translations { locale commonName } ' +
        'imageUrl imageCredit imageLicense imageLicenseUrl';
    var latestStationFields = 'id name detections(first: 1) { nodes { timestamp species { ' +
        speciesFields + ' } } }';
    var earthRadiusKm = 6371.0088;
    var radiansPerDegree = Math.PI / 180;

    function query(operation, variables, complete) {
        var request = new window.XMLHttpRequest();
        request.open('POST', endpoint, true);
        request.timeout = 15000;
        request.setRequestHeader('Content-Type', 'application/json');

        request.onload = function () {
            if (request.status === 404) {
                complete('notFound');
                return;
            }
            if (request.status !== 200 || request.responseText.length > 512000) {
                complete('unavailable');
                return;
            }
            var response;
            try {
                response = JSON.parse(request.responseText);
            } catch (error) {
                complete('unavailable');
                return;
            }
            if (!response || response.errors || !response.data) {
                complete('unavailable');
                return;
            }
            complete(null, response.data);
        };
        request.onerror = request.ontimeout = function () {
            complete('unavailable');
        };

        request.send(JSON.stringify({ query: operation, variables: variables }));
        return request;
    }

    function validStationId(value) {
        return typeof value === 'string' && /^[1-9][0-9]{0,17}$/.test(value);
    }

    function validCoordinates(coordinates) {
        return coordinates && typeof coordinates.lat === 'number' && typeof coordinates.lon === 'number' &&
            coordinates.lat >= -90 && coordinates.lat <= 90 && coordinates.lon >= -180 && coordinates.lon <= 180;
    }

    function readId(value) {
        return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
    }

    function safeName(value, maxLength) {
        return typeof value === 'string' && value.length <= maxLength ? value.trim() : '';
    }

    function readObservation(node) {
        if (!node || !node.species || typeof node.timestamp !== 'string' || node.timestamp.length > 40) {
            return null;
        }
        var offset = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(Z|([+-])(\d\d):(\d\d))$/.exec(node.timestamp);
        var time = Date.parse(node.timestamp);
        var scientificName = safeName(node.species.scientificName, 160);
        var speciesId = readId(node.species.id);
        if (!offset || !isFinite(time) || !scientificName || !validStationId(speciesId)) {
            return null;
        }
        var offsetMinutes = offset[1] === 'Z' ? 0 :
            (Number(offset[3]) * 60 + Number(offset[4])) * (offset[2] === '-' ? -1 : 1);
        return {
            timestamp: node.timestamp,
            time: time,
            offsetMinutes: offsetMinutes,
            zone: offset[1] === 'Z' ? 'UTC' : 'UTC' + offset[1],
            species: {
                id: speciesId,
                scientificName: scientificName,
                commonName: safeName(node.species.commonName, 160) || scientificName,
                translations: Array.isArray(node.species.translations) ? node.species.translations : [],
                imageUrl: safeName(node.species.imageUrl, 512),
                imageCredit: safeName(node.species.imageCredit, 1024),
                imageLicense: safeName(node.species.imageLicense, 80),
                imageLicenseUrl: safeName(node.species.imageLicenseUrl, 512)
            }
        };
    }

    function readStationLatest(station, stationId) {
        var summary = stationResult(station);
        var nodes = station && station.detections && station.detections.nodes;
        if (!summary || summary.id !== stationId || !Array.isArray(nodes) || nodes.length > 1) {
            return null;
        }
        var observation = nodes.length ? readObservation(nodes[0]) : null;
        return nodes.length && !observation ? null : { stationName: summary.name, observation: observation };
    }

    function latestForStation(stationId, complete) {
        // The nested connection includes historical detections and returns the newest first.
        var operation = 'query LatestForStation($stationId: ID!) { station(id: $stationId) { ' +
            latestStationFields + ' } }';
        return query(operation, { stationId: stationId }, function (error, data) {
            if (error || data.station === null) {
                complete(error || 'notFound');
                return;
            }
            var result = readStationLatest(data.station, stationId);
            complete(result ? null : 'unavailable', result);
        });
    }

    function boundingBoxes(coordinates, angularRadius) {
        // Pad the rectangular search by a fraction of a metre before applying the circular cutoff.
        var padding = 0.000000001;
        var latDelta = angularRadius / radiansPerDegree + padding;
        var north = Math.min(90, coordinates.lat + latDelta);
        var south = Math.max(-90, coordinates.lat - latDelta);

        function box(west, east) {
            return { sw: { lat: south, lon: west }, ne: { lat: north, lon: east } };
        }

        if (north === 90 || south === -90) {
            return [box(-180, 180)];
        }
        var lonDelta = Math.asin(Math.sin(angularRadius) / Math.cos(coordinates.lat * radiansPerDegree)) /
            radiansPerDegree + padding;
        var west = coordinates.lon - lonDelta;
        var east = coordinates.lon + lonDelta;
        // BirdWeather accepts ordinary rectangles with west <= east.
        if (west < -180) {
            return [box(west + 360, 180), box(-180, east)];
        }
        if (east > 180) {
            return [box(west, 180), box(-180, east - 360)];
        }
        return [box(west, east)];
    }

    function squareSineOfHalf(angle) {
        var sine = Math.sin(angle / 2);
        return sine * sine;
    }

    function nearbyStationIds(coordinates, radius, complete) {
        var angularRadius = Number(radius) / earthRadiusKm;
        var boxes = boundingBoxes(coordinates, angularRadius);
        var maxHaversine = squareSineOfHalf(angularRadius);
        var centerCosine = Math.cos(coordinates.lat * radiansPerDegree);
        var seenIds = Object.create(null);
        var stationIds = [];
        var boxIndex = 0;
        var seenCursors = Object.create(null);
        var request;
        var operation = 'query NearbyStations($sw: InputLocation!, $ne: InputLocation!, $after: String) {' +
            ' stations(first: 100, sw: $sw, ne: $ne, after: $after) {' +
            ' nodes { id coords { lat lon } } pageInfo { hasNextPage endCursor } } }';

        function insideRadius(point) {
            // The haversine compares great-circle distance on a sphere and wraps across longitude ±180°.
            var latDifference = (point.lat - coordinates.lat) * radiansPerDegree;
            var lonDifference = (point.lon - coordinates.lon) * radiansPerDegree;
            return squareSineOfHalf(latDifference) + centerCosine * Math.cos(point.lat * radiansPerDegree) *
                squareSineOfHalf(lonDifference) <= maxHaversine;
        }

        function fetchPage(after) {
            var box = boxes[boxIndex];
            request = query(operation, { sw: box.sw, ne: box.ne, after: after }, function (error, data) {
                var page = !error && data.stations;
                var info = page && page.pageInfo;
                if (!info || typeof info.hasNextPage !== 'boolean' || !Array.isArray(page.nodes) ||
                        page.nodes.length > 100) {
                    complete('unavailable');
                    return;
                }
                page.nodes.forEach(function (node) {
                    var id = node && readId(node.id);
                    if (validStationId(id) && !seenIds[id] && validCoordinates(node.coords) && insideRadius(node.coords)) {
                        stationIds.push(id);
                        seenIds[id] = true;
                    }
                });
                if (info.hasNextPage) {
                    var cursor = info.endCursor;
                    if (typeof cursor !== 'string' || !cursor || cursor.length > 512 || seenCursors[cursor]) {
                        complete('unavailable');
                        return;
                    }
                    seenCursors[cursor] = true;
                    fetchPage(cursor);
                } else {
                    boxIndex += 1;
                    if (boxIndex < boxes.length) {
                        seenCursors = Object.create(null);
                        fetchPage(null);
                    } else {
                        complete(null, stationIds);
                    }
                }
            });
        }

        fetchPage(null);
        return { abort: function () { request.abort(); } };
    }

    function latestForSource(config, complete) {
        if (config.source === 'station') {
            return latestForStation(config.station, complete);
        }
        var newest = { stationName: '', observation: null };
        var request = nearbyStationIds(config.coordinates, config.radius, function (error, ids) {
            if (error) {
                complete(error);
                return;
            }
            newest.hasStations = ids.length > 0;
            fetchLatest(ids, 0);
        });

        function fetchLatest(ids, offset) {
            if (offset === ids.length) {
                complete(null, newest);
                return;
            }
            // Up to three detection fields per GraphQL request. Keep station-specific detection filters.
            var batch = ids.slice(offset, offset + 3);
            var variables = {};
            var declarations = [];
            var selections = [];
            batch.forEach(function (id, index) {
                var key = 'station' + index;
                variables[key] = id;
                declarations.push('$' + key + ': ID!');
                selections.push(key + ': station(id: $' + key + ') { ' + latestStationFields + ' }');
            });
            var operation = 'query LatestNearby(' + declarations.join(', ') + ') { ' + selections.join(' ') + ' }';
            request = query(operation, variables, function (error, data) {
                if (error) {
                    complete('unavailable');
                    return;
                }
                for (var index = 0; index < batch.length; index += 1) {
                    var station = data['station' + index];
                    if (station === null) {
                        continue; // The station was removed after the search.
                    }
                    var result = readStationLatest(station, batch[index]);
                    if (!result) {
                        complete('unavailable');
                        return;
                    }
                    if (result.observation && (!newest.observation || result.observation.time > newest.observation.time)) {
                        newest.stationName = result.stationName;
                        newest.observation = result.observation;
                    }
                }
                fetchLatest(ids, offset + batch.length);
            });
        }

        return { abort: function () { request.abort(); } };
    }

    function stationResult(node) {
        var id = node && readId(node.id);
        var name = node && safeName(node.name, 220);
        return validStationId(id) && name && !/[\x00-\x1f\x7f]/.test(name) ? { id: id, name: name } : null;
    }

    function searchStations(term, complete) {
        if (validStationId(term)) {
            return query('query FindStation($stationId: ID!) { station(id: $stationId) { id name } }',
                { stationId: term }, function (error, data) {
                    if (error === 'notFound' || (!error && data.station === null)) {
                        complete(null, []);
                        return;
                    }
                    var station = !error && stationResult(data.station);
                    if (!station || station.id !== term) {
                        complete('unavailable');
                        return;
                    }
                    complete(null, [station]);
                });
        }

        return query('query SearchStations($term: String!) { stations(first: 12, query: $term) { nodes { id name } } }',
            { term: term }, function (error, data) {
                var nodes = !error && data.stations && data.stations.nodes;
                if (!Array.isArray(nodes) || nodes.length > 12) {
                    complete('unavailable');
                    return;
                }
                var results = [];
                var seen = {};
                nodes.forEach(function (node) {
                    var station = stationResult(node);
                    if (station && !seen[station.id]) {
                        results.push(station);
                        seen[station.id] = true;
                    }
                });
                if (nodes.length && !results.length) {
                    complete('unavailable');
                    return;
                }
                complete(null, results);
            });
    }

    window.BirdWeatherApi = {
        query: query,
        validStationId: validStationId,
        validCoordinates: validCoordinates,
        searchStations: searchStations,
        latestForStation: latestForStation,
        nearbyStationIds: nearbyStationIds,
        latestForSource: latestForSource
    };
}(window));
