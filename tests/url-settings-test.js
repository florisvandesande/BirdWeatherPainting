(function (window, document) {
    'use strict';

    var status = document.getElementById('test-status');
    var frame = document.getElementById('app-under-test');
    var checks = [];
    var storageAccesses = 0;
    var storageMethods = {};
    var originalStorage = window.Storage && window.Storage.prototype;

    function check(condition, message) {
        if (!condition) {
            throw new Error(message);
        }
        checks.push(message);
    }

    function wait(milliseconds) {
        return new Promise(function (resolve) {
            window.setTimeout(resolve, milliseconds || 0);
        });
    }

    function installStorageGuard() {
        if (!originalStorage) {
            return;
        }
        ['getItem', 'setItem', 'removeItem', 'clear', 'key'].forEach(function (name) {
            storageMethods[name] = originalStorage[name];
            Object.defineProperty(originalStorage, name, {
                configurable: true,
                value: function () {
                    storageAccesses += 1;
                    throw new Error('Application storage access is forbidden in this fixture.');
                }
            });
        });
    }

    function restoreStorageGuard() {
        if (!originalStorage) {
            return;
        }
        Object.keys(storageMethods).forEach(function (name) {
            Object.defineProperty(originalStorage, name, {
                configurable: true,
                value: storageMethods[name]
            });
        });
    }

    function controlledApi(appWindow) {
        var api = appWindow.BirdWeatherApi;
        var species = {
            id: '2',
            commonName: 'Controlled Blackbird',
            scientificName: 'Turdus merula',
            translations: [],
            imageUrl: '',
            imageCredit: '',
            imageLicense: '',
            imageLicenseUrl: ''
        };

        api.searchStations = function (term, complete) {
            complete(null, [{ id: term === '8089' ? '8089' : '1', name: 'Controlled station' }]);
            return { abort: function () {} };
        };
        api.latestForStation = function (stationId, complete) {
            complete(null, { stationName: 'Controlled station ' + stationId, observation: {
                timestamp: '2026-11-07T12:00:00Z',
                time: Date.parse('2026-11-07T12:00:00Z'),
                offsetMinutes: 0,
                zone: 'UTC',
                species: species
            } });
            return { abort: function () {} };
        };
        api.nearbyStationIds = function (coordinates, radius, complete) {
            complete(null, ['8089']);
            return { abort: function () {} };
        };
        api.latestForSource = function (config, complete) {
            if (config.source === 'station') {
                return api.latestForStation(config.station, complete);
            }
            complete(null, { stationName: 'Controlled nearby station', observation: {
                timestamp: '2026-11-07T12:00:00Z',
                time: Date.parse('2026-11-07T12:00:00Z'),
                offsetMinutes: 0,
                zone: 'UTC',
                species: species
            } });
            return { abort: function () {} };
        };
        api.collageStation = function (stationId, complete) {
            complete(null, { id: stationId, name: 'Controlled station', timezone: 'UTC' });
            return { abort: function () {} };
        };
        api.query = function (operation, variables, complete) {
            complete(null, { detections: {
                nodes: [{ id: '1', speciesId: '2',
                    timestamp: new Date(appWindow.Date.now() - 60000).toISOString() }],
                pageInfo: { hasNextPage: false, endCursor: null }
            } });
            return { abort: function () {} };
        };
        api.speciesForIds = function (ids, complete) {
            complete(null, ids.map(function () { return species; }));
            return { abort: function () {} };
        };
    }

    function loadApp(url) {
        return new Promise(function (resolve) {
            frame.onload = function () {
                controlledApi(frame.contentWindow);
                window.setTimeout(function () { resolve(frame.contentWindow); }, 20);
            };
            frame.src = url;
        });
    }

    function dispatch(appWindow, node, type) {
        var event = appWindow.document.createEvent('Event');
        event.initEvent(type || 'change', true, true);
        node.dispatchEvent(event);
    }

    async function waitForFrameUrl(pattern) {
        var attempt;
        for (attempt = 0; attempt < 100; attempt += 1) {
            if (pattern.test(frame.contentDocument.URL)) {
                return frame.contentDocument.URL;
            }
            await wait(20);
        }
        return frame.contentDocument.URL;
    }

    async function saveStation(appWindow) {
        var appDocument = appWindow.document;
        var search = appDocument.getElementById('station-query');
        search.value = '8089';
        var form = appDocument.getElementById('station-search');
        dispatch(appWindow, form, 'submit');
        await wait(10);
        var result = appDocument.querySelector('#station-results button');
        check(result, 'Station setup presents the deterministic station search result.');
        result.click();
        appDocument.getElementById('display-view').value = 'today';
        dispatch(appWindow, appDocument.getElementById('display-view'));
        appDocument.getElementById('collage-limit').value = '12';
        appDocument.getElementById('display-language').value = 'nl';
        dispatch(appWindow, appDocument.getElementById('display-language'));
        appDocument.getElementById('night-enabled').checked = false;
        dispatch(appWindow, appDocument.getElementById('night-enabled'));
        appDocument.getElementById('save-settings').click();
        await waitForFrameUrl(/\?source=station&/);
    }

    async function saveNearby(appWindow) {
        var appDocument = appWindow.document;
        var source = appDocument.getElementById('detection-source');
        source.value = 'nearby';
        dispatch(appWindow, source);
        appDocument.getElementById('nearby-latitude').value = '52.123456';
        appDocument.getElementById('nearby-longitude').value = '5.123454';
        appDocument.getElementById('nearby-radius').value = '5';
        appDocument.getElementById('display-view').value = 'latest';
        appDocument.getElementById('display-language').value = 'auto';
        dispatch(appWindow, appDocument.getElementById('display-language'));
        appDocument.getElementById('night-enabled').checked = true;
        dispatch(appWindow, appDocument.getElementById('night-enabled'));
        appDocument.getElementById('night-start').value = '23:00';
        appDocument.getElementById('night-end').value = '23:30';
        appDocument.getElementById('save-settings').click();
        await waitForFrameUrl(/\?source=nearby&/);
    }

    async function run() {
        window.localStorage.setItem('birdweather.setup', JSON.stringify({ source: 'station', station: '9999' }));
        window.localStorage.setItem('birdweather.language', JSON.stringify('fr'));
        installStorageGuard();

        var appWindow = await loadApp('../index.html');
        var appDocument = appWindow.document;
        check(!appDocument.getElementById('setup').hidden, 'The bare URL always opens visible setup.');
        check(appDocument.getElementById('painting').hidden, 'The bare URL does not open the painting.');
        check(storageAccesses === 0, 'The app does not read obsolete browser configuration storage (accesses: ' + storageAccesses + ').');
        check(!appDocument.getElementById('artwork-missing'), 'The missing-artwork report is absent from the information surface.');

        await saveStation(appWindow);
        check(/\?source=station&station=8089&view=today&limit=12&lang=nl&night=0$/.test(frame.contentDocument.URL),
            'Saving station setup navigates to the canonical URL with every explicit setting (' + frame.contentDocument.URL + ').');
        check(storageAccesses === 0, 'Saving settings does not write browser configuration storage.');

        appWindow = await loadApp('../index.html');
        await saveNearby(appWindow);
        check(/\?source=nearby&lat=52\.12346&lon=5\.12345&radius=5&view=latest&limit=12&lang=auto&night=1&nightStart=23%3A00&nightEnd=23%3A30$/.test(frame.contentDocument.URL),
            'Saving nearby setup rounds coordinates and writes the canonical URL in stable order (' + frame.contentDocument.URL + ').');

        appWindow = await loadApp('../index.html?source=station&station=8089&view=latest&limit=7&lang=fr&night=0');
        appDocument = appWindow.document;
        check(appDocument.getElementById('setup').hidden && !appDocument.getElementById('painting').hidden,
            'A complete station URL opens the painting instead of setup.');
        check(appDocument.documentElement.lang === 'fr', 'A complete station URL selects its requested language.');
        appDocument.getElementById('open-settings').click();
        check(appDocument.getElementById('display-view').value === 'latest' &&
            appDocument.getElementById('collage-limit').value === '7',
            'Opening Settings preserves the requested view and collage limit from the URL.');
        appDocument.getElementById('cancel-settings').click();
        appDocument.getElementById('artwork-button').click();
        await wait(500);
        check(appDocument.querySelector('#daily-species-list button'),
            'The information surface still shows daily species details.');
        appDocument.querySelector('#daily-species-list button').click();
        await wait(500);
        check(/Fugleramme Classic|CC BY-SA 4\.0/.test(appDocument.querySelector('.daily-species-details').textContent),
            'Daily species details still show normal artwork credit information.');

        appWindow = await loadApp('../index.html?source=nearby&lat=52.123456&lon=5.123454&radius=5&view=latest&limit=8&lang=auto&night=0');
        appDocument = appWindow.document;
        check(appDocument.getElementById('setup').hidden && !appDocument.getElementById('painting').hidden,
            'A complete nearby URL opens the painting instead of setup.');
        check(appDocument.getElementById('open-settings').getAttribute('aria-label').length > 0,
            'The nearby painting keeps its accessible Settings control.');

        appWindow = await loadApp('../index.html?source=nearby&lat=52.123456&radius=5&view=today&limit=12&lang=nl&night=0');
        appDocument = appWindow.document;
        check(!appDocument.getElementById('setup').hidden, 'A nearby URL without longitude returns to setup.');
        check(appDocument.getElementById('nearby-latitude').value === '52.123456',
            'Valid fields from a partial nearby URL remain filled in.');
        check(appDocument.getElementById('location-status').textContent.length > 0,
            'A partial nearby URL shows an actionable location message.');

        appWindow = await loadApp('../index.html?source=station&station=8089&view=bad&limit=12&lang=nl&night=0');
        appDocument = appWindow.document;
        check(!appDocument.getElementById('setup').hidden, 'An invalid view value returns to setup.');
        check(appDocument.getElementById('setup-url-status').textContent.length > 0,
            'Invalid URL values show an actionable setup message.');
        check(appDocument.getElementById('painting').hidden,
            'The invalid URL never opens the painting.');

        status.setAttribute('data-result', 'passed');
        status.textContent = 'Passed: ' + checks.length + ' URL-only configuration checks.';
    }

    run().catch(function (error) {
        status.setAttribute('data-result', 'failed');
        status.textContent = 'Failed: ' + (error && error.message ? error.message : String(error));
        if (window.console && window.console.error) {
            window.console.error(error);
        }
    }).then(function () {
        restoreStorageGuard();
    });
}(window, document));
