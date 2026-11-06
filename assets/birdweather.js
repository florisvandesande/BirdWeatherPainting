(function (window) {
    'use strict';

    var endpoint = 'https://app.birdweather.com/graphql';
    var speciesFields = 'id commonName scientificName translations { locale commonName } ' +
        'imageUrl imageCredit imageLicense imageLicenseUrl';

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

    function latestForStation(stationId, complete) {
        // The nested connection includes historical detections and returns the newest first.
        var operation = 'query LatestForStation($stationId: ID!) {' +
            ' station(id: $stationId) { id name detections(first: 1) { nodes {' +
            ' timestamp species { ' + speciesFields + ' }' +
            ' } } } }';
        return query(operation, { stationId: stationId }, function (error, data) {
            if (error) {
                complete(error);
                return;
            }
            if (data.station === null) {
                complete('notFound');
                return;
            }
            var station = data.station;
            var nodes = station && station.detections && station.detections.nodes;
            var name = station && safeName(station.name, 220);
            if (!name || readId(station.id) !== stationId || !Array.isArray(nodes) || nodes.length > 1) {
                complete('unavailable');
                return;
            }
            var observation = nodes.length ? readObservation(nodes[0]) : null;
            if (nodes.length && !observation) {
                complete('unavailable');
                return;
            }
            complete(null, { stationName: name, observation: observation });
        });
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
        searchStations: searchStations,
        latestForStation: latestForStation
    };
}(window));
