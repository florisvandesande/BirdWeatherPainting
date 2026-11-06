(function (window, document) {
    'use strict';

    var api = window.BirdWeatherApi;
    var preferences = window.BirdWeatherPreferences;
    var text = window.BirdWeatherText;
    var setup = document.getElementById('setup');
    var painting = document.getElementById('painting');
    var title = document.getElementById('setup-title');
    var welcomeIntro = document.getElementById('welcome-intro');
    var openButton = document.getElementById('open-settings');
    var saveButton = document.getElementById('save-settings');
    var backButton = document.getElementById('cancel-settings');
    var searchForm = document.getElementById('station-search');
    var searchInput = document.getElementById('station-query');
    var searchStatus = document.getElementById('station-search-status');
    var resultList = document.getElementById('station-results');
    var sourceSelect = document.getElementById('detection-source');
    var stationSettings = document.getElementById('station-source-settings');
    var nearbySettings = document.getElementById('nearby-source-settings');
    var locationButton = document.getElementById('use-location');
    var latitude = document.getElementById('nearby-latitude');
    var longitude = document.getElementById('nearby-longitude');
    var radiusSelect = document.getElementById('nearby-radius');
    var locationStatus = document.getElementById('location-status');
    var locationStatusKey = '';
    var locationAttempt = 0;
    var languageSelect = document.getElementById('display-language');
    var languageStatus = document.getElementById('language-status');
    var selectionSummary = document.getElementById('selected-station');
    var labels = setup.querySelectorAll('[data-text]');
    var config = preferences.read();
    var draft;
    var selectedName;
    var searchRequest = null;
    var statusKey = '';
    var results = [];
    var locale = preferences.locale();

    function say(key, fields) {
        return text.message(locale, key, fields);
    }

    function renderSelection() {
        var station = draft.station;
        var nearby = draft.source === 'nearby';
        stationSettings.hidden = nearby;
        nearbySettings.hidden = !nearby;
        saveButton.disabled = !nearby && !api.validStationId(station);
        if (selectedName) {
            selectionSummary.textContent = say('selectedStationName', { name: selectedName });
        } else {
            selectionSummary.textContent = station ? say('selectedStationId', { id: station }) : '';
        }
    }

    function renderLabels() {
        for (var index = 0; index < labels.length; index += 1) {
            var label = labels[index];
            label.textContent = say(label.getAttribute('data-text'));
        }
        title.textContent = say(config ? 'settingsTitle' : 'welcomeTitle');
        saveButton.textContent = say(config ? 'saveSettings' : 'openPainting');
        openButton.textContent = say('settingsTitle');
        searchStatus.textContent = statusKey ? say(statusKey) : '';
        locationStatus.textContent = locationStatusKey ? say(locationStatusKey) : '';
        renderSelection();
        showResults(results);
    }

    function setStatus(key) {
        statusKey = key;
        searchStatus.textContent = key ? say(key) : '';
    }

    function abortSearch() {
        if (searchRequest) {
            searchRequest.abort();
            searchRequest = null;
        }
    }

    function selectStation(station, button) {
        draft.station = station.id;
        selectedName = station.name;
        var oldChoice = resultList.querySelector('[aria-pressed="true"]');
        if (oldChoice) {
            oldChoice.setAttribute('aria-pressed', 'false');
        }
        button.setAttribute('aria-pressed', 'true');
        renderSelection();
    }

    function showResults(stations) {
        resultList.textContent = '';
        stations.forEach(function (station) {
            var item = document.createElement('li');
            var button = document.createElement('button');
            button.type = 'button';
            button.dir = 'auto';
            button.setAttribute('aria-pressed', String(station.id === draft.station));
            button.textContent = say('stationChoice', { name: station.name, id: station.id });
            button.addEventListener('click', function () {
                selectStation(station, button);
            });
            item.appendChild(button);
            resultList.appendChild(item);
        });
        resultList.hidden = stations.length === 0;
    }

    function search(event) {
        event.preventDefault();
        abortSearch();
        results = [];
        showResults(results);
        var term = searchInput.value.trim();
        if (!term || term.length > 120 || /[\x00-\x1f\x7f]/.test(term) ||
                (/^\d+$/.test(term) && !api.validStationId(term))) {
            setStatus('stationQueryInvalid');
            searchInput.focus();
            return;
        }
        setStatus('searchingStations');
        searchRequest = api.searchStations(term, function (error, stations) {
            searchRequest = null;
            if (error) {
                setStatus('stationSearchUnavailable');
                return;
            }
            setStatus(stations.length ? 'chooseStationResult' : 'stationNoResults');
            results = stations;
            showResults(results);
        });
    }

    function setLocationStatus(key) {
        locationStatusKey = key;
        locationStatus.textContent = key ? say(key) : '';
    }

    function clearCoordinateErrors() {
        latitude.removeAttribute('aria-invalid');
        longitude.removeAttribute('aria-invalid');
    }

    function changeSource() {
        draft.source = sourceSelect.value;
        abortSearch();
        if (statusKey === 'searchingStations') {
            setStatus('');
        }
        if (locationStatusKey === 'locationPending') {
            setLocationStatus('');
        }
        locationAttempt += 1;
        locationButton.disabled = false;
        renderSelection();
    }

    function enterCoordinates() {
        locationAttempt += 1;
        locationButton.disabled = false;
        clearCoordinateErrors();
        setLocationStatus('');
    }

    function requestLocation() {
        var attempt = ++locationAttempt;
        clearCoordinateErrors();
        setLocationStatus('locationPending');
        locationButton.disabled = true;

        function failed(error) {
            if (attempt === locationAttempt) {
                locationButton.disabled = false;
                setLocationStatus(error && error.code === 1 ? 'locationDenied' : 'locationUnavailable');
            }
        }

        try {
            window.navigator.geolocation.getCurrentPosition(function (position) {
                if (attempt !== locationAttempt) {
                    return;
                }
                var coordinates = position && position.coords;
                var location = coordinates && { lat: coordinates.latitude, lon: coordinates.longitude };
                if (!api.validCoordinates(location)) {
                    failed();
                    return;
                }
                latitude.value = String(location.lat);
                longitude.value = String(location.lon);
                locationButton.disabled = false;
                setLocationStatus('locationFound');
            }, failed, { timeout: 12000 });
        } catch (error) {
            failed();
        }
    }

    function readCoordinate(input, limit) {
        var value = input.value.trim().replace(/\u2212/g, '-');
        var number = /^[-+]?(?:[0-9]+(?:[.,][0-9]*)?|[.,][0-9]+)(?:[eE][-+]?[0-9]+)?$/.test(value) ?
            Number(value.replace(',', '.')) : NaN;
        if (!isFinite(number) || number < -limit || number > limit) {
            input.setAttribute('aria-invalid', 'true');
            return null;
        }
        return number;
    }

    function saveSetup() {
        if (draft.source === 'station') {
            preferences.save(draft);
            return;
        }
        enterCoordinates();
        var lat = readCoordinate(latitude, 90);
        var lon = readCoordinate(longitude, 180);
        if (lat === null || lon === null) {
            setLocationStatus('coordinateInvalid');
            (lat === null ? latitude : longitude).focus();
            return;
        }
        draft.coordinates = { lat: lat, lon: lon };
        draft.radius = radiusSelect.value;
        if (!preferences.save(draft)) {
            setLocationStatus('locationStorageUnavailable');
        }
    }

    function openSetup(moveFocus) {
        var nearby = preferences.nearbyDraft();
        draft = { source: nearby.selected ? 'nearby' : 'station', station: config && config.station };
        sourceSelect.value = draft.source;
        radiusSelect.value = nearby.radius;
        latitude.value = nearby.coordinates ? String(nearby.coordinates.lat) : '';
        longitude.value = nearby.coordinates ? String(nearby.coordinates.lon) : '';
        clearCoordinateErrors();
        locationButton.disabled = false;
        locationStatusKey = nearby.selected && !nearby.coordinates ? 'locationRequired' : '';
        selectedName = '';
        searchInput.value = '';
        results = [];
        statusKey = !nearby.selected && !config && preferences.hasSourceParameter() ? 'stationAddressInvalid' : '';
        languageSelect.value = preferences.getLanguage();
        welcomeIntro.hidden = Boolean(config);
        backButton.hidden = !config;
        renderLabels();
        painting.hidden = true;
        setup.hidden = false;
        if (moveFocus) {
            window.scrollTo(0, 0);
            title.focus();
        }
    }

    function closeSetup() {
        abortSearch();
        locationAttempt += 1;
        setup.hidden = true;
        painting.hidden = false;
        window.scrollTo(0, 0);
        openButton.focus();
    }

    function changeLanguage() {
        var stored = preferences.setLanguage(languageSelect.value);
        locale = preferences.locale();
        renderLabels();
        languageStatus.textContent = stored ? '' : say('languageStorageUnavailable');
        var event = document.createEvent('Event');
        event.initEvent('birdweather-language', false, false);
        document.dispatchEvent(event);
    }

    searchForm.addEventListener('submit', search);
    sourceSelect.addEventListener('change', changeSource);
    locationButton.addEventListener('click', requestLocation);
    latitude.addEventListener('input', enterCoordinates);
    longitude.addEventListener('input', enterCoordinates);
    languageSelect.addEventListener('change', changeLanguage);
    openButton.addEventListener('click', function () {
        openSetup(true);
    });
    backButton.addEventListener('click', closeSetup);
    saveButton.addEventListener('click', saveSetup);

    if (config) {
        openButton.textContent = say('settingsTitle');
        painting.hidden = false;
    } else {
        openSetup(false);
    }
}(window, document));
