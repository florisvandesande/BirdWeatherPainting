(function (window) {
    'use strict';

    var fixedNow = Date.parse('2026-11-07T12:00:00Z');
    var RealDate = Date;
    var messages = [];
    var speciesRequests = [];
    var pages = [];
    var species = {
        '1': { id: '1', commonName: 'First bird', scientificName: 'Avis prima' },
        '2': { id: '2', commonName: 'Second bird', scientificName: 'Avis secunda' },
        '3': { id: '3', commonName: 'Newest bird', scientificName: 'Avis tertia' }
    };
    for (var speciesId = 4; speciesId <= 34; speciesId += 1) {
        species[String(speciesId)] = {
            id: String(speciesId),
            commonName: 'Test bird ' + speciesId,
            scientificName: 'Avis ' + speciesId
        };
    }

    function FixedDate(value) {
        return new RealDate(value);
    }
    FixedDate.now = function () { return fixedNow; };
    FixedDate.parse = RealDate.parse;
    FixedDate.UTC = RealDate.UTC;
    window.Date = FixedDate;
    window.BirdWeatherCollageDay = {
        stationDate: function (time) { return new RealDate(time).toISOString().slice(0, 10); },
        deviceDate: function (time) { return new RealDate(time).toDateString(); },
        nearbyPeriod: function () { return {}; }
    };
    window.BirdWeatherApi = {
        validStationId: function (value) { return /^[1-9][0-9]*$/.test(value); },
        collageStation: function (id, complete) {
            complete(null, { id: id, name: 'Test station', timezone: 'UTC' });
            return { abort: function () {} };
        },
        query: function (operation, variables, complete) {
            pages.push(variables.after);
            if (variables.after === null) {
                complete(null, { detections: {
                    nodes: [
                        { id: '100', speciesId: '1', timestamp: '2026-11-07T09:00:00Z' },
                        { id: '101', speciesId: '2', timestamp: '2026-11-07T10:00:00Z' }
                    ],
                    pageInfo: { hasNextPage: true, endCursor: 'next-page' }
                } });
            } else {
                var nodes = [
                    { id: '102', speciesId: '2', timestamp: '2026-11-07T11:00:00Z' },
                    { id: '103', speciesId: '3', timestamp: '2026-11-07T11:30:00Z' },
                    { id: '100', speciesId: '1', timestamp: '2026-11-07T09:00:00Z' }
                ];
                for (var id = 4; id <= 34; id += 1) {
                    nodes.push({
                        id: String(1000 + id),
                        speciesId: String(id),
                        timestamp: '2026-11-07T08:00:00Z'
                    });
                }
                complete(null, { detections: {
                    nodes: nodes,
                    pageInfo: { hasNextPage: false, endCursor: null }
                } });
            }
            return { abort: function () {} };
        },
        speciesForIds: function (ids, complete) {
            speciesRequests.push(ids.slice());
            complete(null, ids.map(function (id) { return species[id]; }));
            return { abort: function () {} };
        }
    };

    function assertEqual(actual, expected, message) {
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
            throw new Error(message + ': expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
        }
        messages.push('PASS ' + message);
    }

    window.runDailyDataTest = function () {
        var failure = null;
        try {
            window.BirdWeatherCollageData.create({ source: 'station', station: '7' }, 2).load(function (error, data) {
                if (error) {
                    throw new Error('daily scan failed: ' + error);
                }
                assertEqual(data.species.map(function (bird) { return bird.id; }), ['2', '3'],
                    'the collage keeps the newest unique species in oldest-to-newest display order');
                assertEqual(data.dailySpecies.slice(0, 3).map(function (bird) { return bird.id; }), ['3', '2', '1'],
                    'daily rows retain the established ranking across detection pages');
                assertEqual(data.dailySpecies.length, 34,
                    'the daily species list includes every unique species beyond the collage limit');
                assertEqual(speciesRequests.map(function (batch) { return batch.length; }), [32, 2],
                    'all daily species metadata is fetched in API-sized batches');
                assertEqual(speciesRequests.reduce(function (ids, batch) { return ids.concat(batch); }, []).sort(function (first, second) {
                    return Number(first) - Number(second);
                }), [
                    '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17',
                    '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31', '32', '33', '34'
                ], 'metadata is loaded for every observed species');
                assertEqual(data.omitted, 32, 'the collage omitted count remains unchanged');
                assertEqual(pages.length, 2, 'the paginated detection scan remains in use');
            });
        } catch (error) {
            failure = error;
            messages.push(error.message || String(error), error.stack || '');
        }

        var output = window.document && window.document.getElementById('result');
        if (output) {
            output.textContent = failure ? 'FAIL' : 'PASS';
            output.style.color = failure ? 'red' : 'green';
            window.document.getElementById('details').textContent = messages.join('\n');
        }
        window.dailyDataTestResult = { passed: !failure, details: messages.join('\n') };
        return window.dailyDataTestResult;
    };
}(window));
