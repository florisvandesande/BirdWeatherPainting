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
        var fallbackSpecies = {
            id: '3',
            commonName: 'Controlled Artwork Fallback',
            scientificName: 'Species without local artwork',
            translations: [],
            imageUrl: '',
            imageCredit: '',
            imageLicense: '',
            imageLicenseUrl: ''
        };

        function responseSpecies() {
            return /(?:^|[?&])fallback=1(?:&|$)/.test(appWindow.location.search) ? fallbackSpecies : species;
        }

        function responseObservation() {
            if (/(?:^|[?&])empty=1(?:&|$)/.test(appWindow.location.search)) {
                return null;
            }
            return {
                timestamp: '2026-11-07T12:00:00Z',
                time: Date.parse('2026-11-07T12:00:00Z'),
                offsetMinutes: 0,
                zone: 'UTC',
                species: responseSpecies()
            };
        }

        api.searchStations = function (term, complete) {
            complete(null, [{ id: term === '8089' ? '8089' : '1', name: 'Controlled station' }]);
            return { abort: function () {} };
        };
        api.latestForStation = function (stationId, complete) {
            complete(null, { stationName: 'Controlled station ' + stationId, observation: responseObservation() });
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
            complete(null, { stationName: 'Controlled nearby station', observation: responseObservation() });
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
            complete(null, ids.map(function () { return responseSpecies(); }));
            return { abort: function () {} };
        };
    }

    function loadApp(url) {
        return new Promise(function (resolve) {
            frame.onload = function () {
                var appWindow = frame.contentWindow;
                check(appWindow.BirdWeatherFixture && typeof appWindow.BirdWeatherFixture.start === 'function',
                    'The app exposes the deterministic URL fixture startup seam before requesting BirdWeather.');
                appWindow.Math.random = function () { return 0; };
                controlledApi(appWindow);
                appWindow.BirdWeatherFixture.start();
                window.setTimeout(function () { resolve(appWindow); }, 20);
            };
            frame.src = url + (url.indexOf('?') === -1 ? '?' : '&') + 'fixture=url-settings';
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
            appDocument.getElementById('collage-limit').value === '7' &&
            appDocument.getElementById('display-language').value === 'fr' &&
            !appDocument.getElementById('night-enabled').checked,
            'Opening Settings preserves the station URL view, language, collage limit, and disabled night setting.');
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
        appDocument.getElementById('open-settings').click();
        check(appDocument.getElementById('display-view').value === 'latest' &&
            appDocument.getElementById('collage-limit').value === '8' &&
            appDocument.getElementById('display-language').value === 'auto' &&
            !appDocument.getElementById('night-enabled').checked,
            'Opening Settings preserves the nearby URL view, language, collage limit, and disabled night setting.');
        appDocument.getElementById('cancel-settings').click();

        appWindow = await loadApp('../index.html?source=nearby&lat=52.123456&lon=5.123454&radius=5&view=today&limit=9&lang=nl&night=1&nightStart=23%3A00&nightEnd=23%3A30');
        appDocument = appWindow.document;
        appDocument.getElementById('open-settings').click();
        check(appDocument.getElementById('display-view').value === 'today' &&
            appDocument.getElementById('collage-limit').value === '9' &&
            appDocument.getElementById('display-language').value === 'nl' &&
            appDocument.getElementById('night-enabled').checked &&
            appDocument.getElementById('night-start').value === '23:00' &&
            appDocument.getElementById('night-end').value === '23:30',
            'Opening Settings preserves the nearby URL view, language, collage limit, and enabled night schedule.');

        appWindow = await loadApp('../index.html?source=nearby&lat=52.123456&radius=5&view=today&limit=12&lang=nl&night=0');
        appDocument = appWindow.document;
        check(!appDocument.getElementById('setup').hidden, 'A nearby URL without longitude returns to setup.');
        check(appDocument.getElementById('nearby-latitude').value === '52.123456',
            'Valid fields from a partial nearby URL remain filled in.');
        check(appDocument.getElementById('location-status').textContent.length > 0,
            'A partial nearby URL shows an actionable location message.');

        appWindow = await loadApp('../index.html?source=nearby&lat=91&lon=5&radius=5&view=latest&limit=12&lang=nl&night=0');
        appDocument = appWindow.document;
        check(!appDocument.getElementById('setup').hidden && appDocument.getElementById('painting').hidden,
            'A nearby URL with invalid coordinates returns to setup.');
        check(appDocument.getElementById('location-status').textContent.length > 0,
            'Invalid nearby coordinates show an actionable location message.');

        appWindow = await loadApp('../index.html?source=nearby&lat=52.12345&lon=5.12345&radius=3&view=latest&limit=12&lang=nl&night=0');
        appDocument = appWindow.document;
        check(!appDocument.getElementById('setup').hidden &&
            /radius|straal|rayon|radio|raggio|raio/i.test(appDocument.getElementById('setup-url-status').textContent),
            'An invalid nearby radius identifies the radius field instead of reporting invalid coordinates.');
        check(appDocument.getElementById('location-status').textContent === '',
            'An invalid nearby radius does not report that a location is required when coordinates are valid.');

        async function assertNearbyUrlInvalid(query, label) {
            var nearbyWindow = await loadApp('../index.html?source=nearby&lat=52.12345&lon=5.12345&radius=5&' + query);
            var nearbyDocument = nearbyWindow.document;
            check(!nearbyDocument.getElementById('setup').hidden && nearbyDocument.getElementById('painting').hidden,
                label + ' returns to setup with valid nearby coordinates preserved.');
            check(nearbyDocument.getElementById('location-status').textContent === '' &&
                /link|lien|enlace|collegamento/i.test(nearbyDocument.getElementById('setup-url-status').textContent),
                label + ' reports the invalid URL field instead of locationRequired.');
        }

        await assertNearbyUrlInvalid('view=bad&limit=12&lang=en&night=0', 'An invalid nearby view');
        await assertNearbyUrlInvalid('view=latest&limit=1&lang=en&night=0', 'An invalid nearby limit');
        await assertNearbyUrlInvalid('view=latest&limit=12&lang=xx&night=0', 'An invalid nearby language');
        await assertNearbyUrlInvalid('view=latest&limit=12&lang=en&night=1&nightStart=bad&nightEnd=23%3A30',
            'An invalid nearby night schedule');

        appWindow = await loadApp('../index.html?source=station&station=8089&view=bad&limit=12&lang=nl&night=0');
        appDocument = appWindow.document;
        check(!appDocument.getElementById('setup').hidden, 'An invalid view value returns to setup.');
        check(appDocument.getElementById('setup-url-status').textContent.length > 0,
            'Invalid URL values show an actionable setup message.');
        check(appDocument.getElementById('painting').hidden,
            'The invalid URL never opens the painting.');

        appWindow = await loadApp('../index.html?source=station&station=8089&view=latest&limit=1&lang=nl&night=0');
        appDocument = appWindow.document;
        check(!appDocument.getElementById('setup').hidden && appDocument.getElementById('setup-url-status').textContent.length > 0,
            'An invalid collage limit returns to setup with an actionable message.');

        appWindow = await loadApp('../index.html?source=station&station=8089&view=latest&limit=12&lang=xx&night=0');
        appDocument = appWindow.document;
        check(!appDocument.getElementById('setup').hidden && appDocument.getElementById('setup-url-status').textContent.length > 0,
            'An invalid language returns to setup with an actionable message.');

        appWindow = await loadApp('../index.html?source=station&station=8089&view=latest&limit=12&lang=nl&night=1&nightStart=bad&nightEnd=23%3A30');
        appDocument = appWindow.document;
        check(!appDocument.getElementById('setup').hidden && appDocument.getElementById('night-status').textContent.length > 0,
            'An invalid night schedule returns to setup with an actionable message.');

        appWindow = await loadApp('../index.html?source=station&station=8089&view=latest&limit=12&limit=12&lang=nl&night=0');
        appDocument = appWindow.document;
        check(!appDocument.getElementById('setup').hidden && appDocument.getElementById('setup-url-status').textContent.length > 0,
            'A duplicate configuration parameter returns to setup instead of choosing silently.');

        appWindow = await loadApp('../index.html?source=station&station=8089&view=latest&limit=12&lang=nl&night=0&legacy=ignored');
        appDocument = appWindow.document;
        check(appDocument.getElementById('setup').hidden && !appDocument.getElementById('painting').hidden,
            'An unknown legacy parameter is ignored while the complete canonical configuration opens the painting.');

        appWindow = await loadApp('../index.html?source=station&station=8089&view=latest&limit=12&lang=nl&night=0&fallback=1');
        appDocument = appWindow.document;
        await wait(500);
        check(/assets\/field-sprig\.svg$/.test(appDocument.getElementById('latest-art').src),
            'Missing local artwork uses the artwork fallback image.');

        appWindow = await loadApp('../index.html?source=station&station=8089&view=latest&limit=12&lang=nl&night=0&empty=1');
        appDocument = appWindow.document;
        await wait(500);
        check(/assets\/artwork\/perches\/[a-z-]+\.jpg$/.test(appDocument.getElementById('latest-art').src),
            'An empty result uses a deterministic Perch fallback image.');

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
