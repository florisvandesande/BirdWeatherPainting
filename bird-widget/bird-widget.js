(function (window, document) {
    'use strict';

    var defaultStationId = '8089';
    var endpoint = 'https://app.birdweather.com/graphql';
    var indexUrl = 'https://florisvandesande.github.io/BirdWeatherPainting/assets/artwork/widget-index.json';
    var artworkBaseUrl = 'https://florisvandesande.github.io/BirdWeatherPainting/assets/artwork/';
    var stationIdPattern = /^[1-9][0-9]{0,17}$/;
    var stationId = readStationId(document, defaultStationId, stationIdPattern);
    var imagePathPattern = /^(?:birds|perches)\/[a-z0-9_-]+\.png$/;
    var licenseUrl = 'https://creativecommons.org/licenses/by-sa/4.0/';
    var attributionUrl = 'https://github.com/arnegiacomo/fugleramme/blob/main/assets/artwork/classic/ATTRIBUTION.md';
    var defaultPerch = 'perches/birch-twig.png';
    var container = document.getElementById('bird');
    var artworkIndex = null;
    var latestObservation = null;
    var observationLoaded = false;
    var initialPerch = defaultPerch;

    if (!container || !stationIdPattern.test(stationId)) {
        return;
    }

    addClass(container, 'bird');
    container.setAttribute('aria-busy', 'true');
    render(null, defaultPerch);

    requestIndex(function (index) {
        artworkIndex = index;
        initialPerch = choosePerch(index);
        if (observationLoaded) {
            renderLatest();
        } else {
            render(null, initialPerch);
        }
    });

    requestLatest(function (observation) {
        observationLoaded = true;
        latestObservation = observation;
        renderLatest();
    });

    function requestIndex(complete) {
        var request = new XMLHttpRequest();
        request.timeout = 12000;
        request.open('GET', indexUrl, true);
        request.onreadystatechange = function () {
            if (request.readyState !== 4) {
                return;
            }
            var index = null;
            try {
                if (request.status >= 200 && request.status < 300 && request.responseText.length <= 256000) {
                    index = JSON.parse(request.responseText);
                }
            } catch (error) {
                index = null;
            }
            complete(validIndex(index) ? index : null);
        };
        request.onerror = request.ontimeout = function () { complete(null); };
        request.send(null);
    }

    function validIndex(index) {
        if (!index || index.version !== 1 || !isObject(index.birds) || !isObject(index.aliases) ||
                !Array.isArray(index.perches) || !index.perches.length || index.attributionUrl !== attributionUrl ||
                index.licenseUrl !== licenseUrl || index.license !== 'CC BY-SA 4.0') {
            return false;
        }
        var validPerches = index.perches.every(function (path) {
            return typeof path === 'string' && /^perches\/[a-z0-9_-]+\.png$/.test(path);
        });
        var validBirds = Object.keys(index.birds).every(function (name) {
            var paths = index.birds[name];
            return Array.isArray(paths) && paths.length > 0 && paths.every(function (path) {
                return typeof path === 'string' && /^birds\/[a-z0-9_-]+\.png$/.test(path);
            });
        });
        var validAliases = Object.keys(index.aliases).every(function (name) {
            return typeof index.aliases[name] === 'string' && name.length <= 160 && index.aliases[name].length <= 160;
        });
        return validPerches && validBirds && validAliases;
    }

    function isObject(value) {
        return Object.prototype.toString.call(value) === '[object Object]';
    }

    function readStationId(doc, fallback, pattern) {
        var script = doc.currentScript;
        if (!script || !script.src) {
            var scripts = doc.getElementsByTagName('script');
            for (var index = scripts.length - 1; index >= 0; index -= 1) {
                if (/(?:^|\/)bird-widget\.js(?:[?#]|$)/i.test(scripts[index].src || '')) {
                    script = scripts[index];
                    break;
                }
            }
        }
        if (!script || !script.src) {
            return fallback;
        }

        var queryStart = script.src.indexOf('?');
        if (queryStart === -1) {
            return fallback;
        }
        var query = script.src.slice(queryStart + 1).split('#')[0];
        var pairs = query.split('&');
        var stationValues = [];
        for (var pairIndex = 0; pairIndex < pairs.length; pairIndex += 1) {
            var separator = pairs[pairIndex].indexOf('=');
            var name = separator === -1 ? pairs[pairIndex] : pairs[pairIndex].slice(0, separator);
            if (name === 'station') {
                stationValues.push(separator === -1 ? '' : pairs[pairIndex].slice(separator + 1));
            }
        }

        if (stationValues.length !== 1 || !pattern.test(stationValues[0])) {
            return fallback;
        }
        return stationValues[0];
    }

    function addClass(element, className) {
        if (element.classList) {
            element.classList.add(className);
        } else if ((' ' + element.className + ' ').indexOf(' ' + className + ' ') === -1) {
            element.className = (element.className + ' ' + className).replace(/^\s+|\s+$/g, '');
        }
    }

    function requestLatest(complete) {
        var request = new XMLHttpRequest();
        var query = 'query BirdWidgetLatest($stationId: ID!) {' +
            ' station(id: $stationId) { id detections(first: 1) { nodes { timestamp species { id scientificName } } } }' +
            '}';
        request.timeout = 15000;
        request.open('POST', endpoint, true);
        request.setRequestHeader('Content-Type', 'application/json');
        request.onreadystatechange = function () {
            if (request.readyState !== 4) {
                return;
            }
            var response = null;
            try {
                if (request.status === 200 && request.responseText.length <= 128000) {
                    response = JSON.parse(request.responseText);
                }
            } catch (error) {
                response = null;
            }
            var station = response && response.data && response.data.station;
            var nodes = station && station.id === stationId && station.detections && station.detections.nodes;
            var observation = Array.isArray(nodes) && nodes.length === 1 ? readObservation(nodes[0]) : null;
            complete(observation);
        };
        request.onerror = request.ontimeout = function () { complete(null); };
        request.send(JSON.stringify({ query: query, variables: { stationId: stationId } }));
    }

    function readObservation(node) {
        var species = node && node.species;
        var id = species && String(species.id);
        var name = species && typeof species.scientificName === 'string' ? species.scientificName.trim() : '';
        if (!node || typeof node.timestamp !== 'string' || !isFinite(Date.parse(node.timestamp)) ||
                !id || !stationIdPattern.test(id) || !name || name.length > 160 || /[\x00-\x1f\x7f]/.test(name)) {
            return null;
        }
        return { id: id, scientificName: name };
    }

    function renderLatest() {
        if (!latestObservation) {
            render(null, choosePerch(artworkIndex));
            container.setAttribute('aria-busy', 'false');
            return;
        }
        var imagePaths = findImages(latestObservation.scientificName, artworkIndex);
        var imagePath = imagePaths.length ? imagePaths[Number(latestObservation.id) % imagePaths.length] : null;
        if (!imagePath) {
            imagePath = choosePerch(artworkIndex, latestObservation.id);
        }
        render(latestObservation, imagePath);
        container.setAttribute('aria-busy', 'false');
    }

    function findImages(scientificName, index) {
        if (!index) {
            return [];
        }
        var name = normalize(scientificName);
        var candidates = [name];
        var words = name.split(' ');
        if (words.length > 2) {
            candidates.push(words.slice(0, 2).join(' '));
        }
        var paths = [];
        candidates.some(function (candidate) {
            var canonical = index.aliases[candidate] || candidate;
            paths = index.birds[canonical] || index.birds[candidate] || [];
            return paths.length > 0;
        });
        if (!paths.length) {
            Object.keys(index.aliases).some(function (alias) {
                if (candidates.indexOf(index.aliases[alias]) !== -1 && index.birds[alias]) {
                    paths = index.birds[alias];
                    return true;
                }
                return false;
            });
        }
        return paths.filter(function (path) {
            return typeof path === 'string' && /^birds\/[a-z0-9_-]+\.png$/.test(path);
        });
    }

    function normalize(value) {
        return value.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
    }

    function choosePerch(index, stableKey) {
        if (!index || !index.perches.length) {
            return defaultPerch;
        }
        var position = stableKey ? Number(stableKey) % index.perches.length : Math.floor(Math.random() * index.perches.length);
        return index.perches[position] || defaultPerch;
    }

    function render(observation, path) {
        var safePath = typeof path === 'string' && imagePathPattern.test(path) ? path : defaultPerch;
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }

        var image = document.createElement('img');
        image.className = 'bird-image';
        image.src = artworkBaseUrl + safePath;
        image.alt = observation ? observation.scientificName : 'Bird on a perch';
        image.onerror = function () {
            if (artworkIndex && safePath.indexOf('perches/') !== 0) {
                render(observation, choosePerch(artworkIndex, observation && observation.id));
            }
        };
        container.appendChild(image);

    }
}(window, document));
