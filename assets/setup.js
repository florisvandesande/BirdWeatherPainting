(function (window, document) {
    'use strict';

    var api = window.BirdWeatherApi;
    var preferences = window.BirdWeatherPreferences;
    var text = window.BirdWeatherText;
    var night = window.BirdWeatherNight;
    var nightText = window.BirdWeatherNightText;
    var setup = document.getElementById('setup');
    var painting = document.getElementById('painting');
    var title = document.getElementById('setup-title');
    var openButton = document.getElementById('open-settings');
    var saveButton = document.getElementById('save-settings');
    var searchForm = document.getElementById('station-search');
    var searchInput = document.getElementById('station-query');
    var searchStatus = document.getElementById('station-search-status');
    var urlConfigStatus = document.getElementById('url-config-status');
    var stationSettings = document.getElementById('station-source-settings');
    var nearbySettings = document.getElementById('nearby-source-settings');
    var locationButton = document.getElementById('use-location');
    var stationModeButton = document.getElementById('station-mode-button');
    var latitude = document.getElementById('nearby-latitude');
    var longitude = document.getElementById('nearby-longitude');
    var radiusSelect = document.getElementById('nearby-radius');
    var locationStatus = document.getElementById('location-status');
    var locationStatusKey = '';
    var locationAttempt = 0;
    var viewTodayButton = document.getElementById('view-today');
    var viewLatestButton = document.getElementById('view-latest');
    var limitSelect = document.getElementById('collage-limit');
    var languageSelect = document.getElementById('display-language');
    var nightEnabled = document.getElementById('night-enabled');
    var nightTimes = document.getElementById('night-times');
    var nightStart = document.getElementById('night-start');
    var nightEnd = document.getElementById('night-end');
    var nightStatus = document.getElementById('night-status');
    var nightLabels = setup.querySelectorAll('[data-night-text]');
    var savedNight = preferences.readNight();
    var nightStatusKey = '';
    var selectionSummary = document.getElementById('selected-station');
    var labels = setup.querySelectorAll('[data-text]');
    var urlDraft = preferences.draft();
    var config = preferences.read();
    var draft;
    var selectedName = '';
    var stationSelected = false;
    var searchRequest = null;
    var statusKey = '';
    var currentView = urlDraft.view;
    var locale = preferences.locale();

    function say(key, fields) {
        return text.message(locale, key, fields);
    }

    function renderSelection() {
        var station = draft.station;
        var isStation = draft.source === 'station';
        var isNearby = draft.source === 'nearby';
        stationSettings.hidden = !isStation;
        nearbySettings.hidden = isStation;
        locationButton.setAttribute('aria-pressed', String(isNearby));
        stationModeButton.setAttribute('aria-pressed', String(isStation));
        saveButton.disabled = !isNearby && (!isStation || !stationSelected || !api.validStationId(station));
        if (stationSelected && selectedName) {
            selectionSummary.textContent = say('stationChoice', { name: selectedName, id: station });
        } else if (stationSelected) {
            selectionSummary.textContent = station ? say('selectedStationId', { id: station }) : '';
        } else {
            selectionSummary.textContent = '';
        }
    }

    function renderView() {
        viewTodayButton.setAttribute('aria-pressed', String(currentView === 'today'));
        viewLatestButton.setAttribute('aria-pressed', String(currentView === 'latest'));
    }

    function renderNightStatus() {
        nightStatus.textContent = nightStatusKey ? nightText.message(locale, nightStatusKey) : '';
    }

    function changeNight() {
        nightTimes.hidden = !nightEnabled.checked;
        nightStatusKey = '';
        nightStart.removeAttribute('aria-invalid');
        nightEnd.removeAttribute('aria-invalid');
        renderNightStatus();
    }

    function readNightDraft() {
        if (!nightEnabled.checked) {
            var start = night.validTime(nightStart.value) ? nightStart.value : urlDraft.nightStart;
            var end = night.validTime(nightEnd.value) ? nightEnd.value : urlDraft.nightEnd;
            if (start === end) {
                start = urlDraft.nightStart;
                end = urlDraft.nightEnd;
            }
            return night.create(false, start, end);
        }
        var schedule = night.create(true, nightStart.value || null, nightEnd.value || null);
        if (!schedule) {
            var invalidField = night.validTime(nightStart.value) ? nightEnd : nightStart;
            invalidField.setAttribute('aria-invalid', 'true');
            nightStatusKey = 'invalid';
            renderNightStatus();
            invalidField.focus();
        }
        return schedule;
    }

    function renderLabels() {
        for (var index = 0; index < labels.length; index += 1) {
            var label = labels[index];
            label.textContent = say(label.getAttribute('data-text'));
        }
        for (var nightIndex = 0; nightIndex < nightLabels.length; nightIndex += 1) {
            var nightLabel = nightLabels[nightIndex];
            nightLabel.textContent = nightText.message(locale, nightLabel.getAttribute('data-night-text'));
        }
        renderNightStatus();
        title.textContent = say('title');
        saveButton.textContent = say('saveSettings');
        openButton.setAttribute('aria-label', say('settingsTitle'));
        searchStatus.textContent = statusKey ? say(statusKey) : '';
        urlConfigStatus.textContent = urlDraft.hasKnownQuery && !urlDraft.complete ? say('urlConfigIncomplete') : '';
        locationStatus.textContent = locationStatusKey ? say(locationStatusKey) : '';
        renderSelection();
        renderView();
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

    function selectStation(station) {
        draft.station = station.id;
        selectedName = station.name;
        stationSelected = true;
        setStatus('');
        renderSelection();
    }

    function search(event) {
        event.preventDefault();
        if (document.documentElement.classList.contains('night-display')) {
            return;
        }
        abortSearch();
        var term = searchInput.value.trim();
        if (!/^\d{1,18}$/.test(term) || !api.validStationId(term)) {
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
            if (!stations.length) {
                draft.station = '';
                selectedName = '';
                stationSelected = false;
                renderSelection();
                setStatus('stationNoResults');
                return;
            }
            selectStation(stations[0]);
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

    function selectSource(source) {
        draft.source = source;
        urlConfigStatus.textContent = '';
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
        if (source === 'station') {
            searchInput.value = draft.station || '';
            searchInput.focus();
        }
    }

    function enterCoordinates(event) {
        locationAttempt += 1;
        locationButton.disabled = false;
        if (event && event.target) {
            event.target.removeAttribute('aria-invalid');
        }
        urlConfigStatus.textContent = '';
        setLocationStatus('');
    }

    function requestLocation() {
        selectSource('nearby');
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

    function chooseView(view) {
        currentView = view;
        urlConfigStatus.textContent = '';
        renderView();
    }

    function saveSetup() {
        if (draft.source !== 'station' && draft.source !== 'nearby') {
            urlConfigStatus.textContent = say('urlSourceRequired');
            locationButton.focus();
            return;
        }
        draft.view = currentView;
        draft.limit = limitSelect.value;
        draft.lang = preferences.getLanguage();
        if (draft.source === 'nearby') {
            var lat = readCoordinate(latitude, 90);
            var lon = readCoordinate(longitude, 180);
            if (lat === null || lon === null) {
                setLocationStatus('coordinateInvalid');
                (lat === null ? latitude : longitude).focus();
                return;
            }
            draft.coordinates = { lat: lat, lon: lon };
            draft.radius = radiusSelect.value;
        }

        draft.night = readNightDraft();
        if (!draft.night) {
            return;
        }
        var saved = preferences.save(draft);
        if (!saved) {
            urlConfigStatus.textContent = say('urlConfigInvalid');
        }
    }

    function openSetup(moveFocus) {
        urlDraft = preferences.draft();
        [limitSelect, languageSelect, nightEnabled, nightStart, nightEnd, radiusSelect]
            .forEach(function (field) { field.removeAttribute('aria-invalid'); });
        draft = {
            source: urlDraft.source,
            station: urlDraft.station,
            coordinates: { lat: urlDraft.lat, lon: urlDraft.lon },
            radius: urlDraft.radius
        };
        radiusSelect.value = urlDraft.radius;
        latitude.value = urlDraft.lat === null ? '' : String(urlDraft.lat);
        longitude.value = urlDraft.lon === null ? '' : String(urlDraft.lon);
        clearCoordinateErrors();
        if (urlDraft.errors.lat) latitude.setAttribute('aria-invalid', 'true');
        if (urlDraft.errors.lon) longitude.setAttribute('aria-invalid', 'true');
        if (urlDraft.errors.radius) radiusSelect.setAttribute('aria-invalid', 'true');
        if (urlDraft.errors.limit) limitSelect.setAttribute('aria-invalid', 'true');
        if (urlDraft.errors.lang) languageSelect.setAttribute('aria-invalid', 'true');
        if (urlDraft.errors.night) nightEnabled.setAttribute('aria-invalid', 'true');
        locationButton.disabled = false;
        locationStatusKey = draft.source === 'nearby' && (draft.coordinates.lat === null || draft.coordinates.lon === null) ?
            'locationRequired' : '';
        selectedName = '';
        stationSelected = draft.source === 'station' && api.validStationId(draft.station) && !urlDraft.errors.station;
        searchInput.value = draft.station || '';
        statusKey = draft.source === 'station' && urlDraft.errors.station ? 'stationAddressInvalid' : '';
        currentView = urlDraft.view;
        limitSelect.value = urlDraft.limit;
        languageSelect.value = urlDraft.lang;
        nightEnabled.checked = urlDraft.night;
        nightStart.value = urlDraft.nightStart;
        nightEnd.value = urlDraft.nightEnd;
        changeNight();
        if (urlDraft.errors.nightStart) nightStart.setAttribute('aria-invalid', 'true');
        if (urlDraft.errors.nightEnd) nightEnd.setAttribute('aria-invalid', 'true');
        nightStatusKey = urlDraft.errors.nightStart || urlDraft.errors.nightEnd ? 'invalidSaved' : '';
        renderLabels();
        painting.hidden = true;
        setup.hidden = false;
        if (moveFocus) {
            window.scrollTo(0, 0);
            title.focus();
        }
    }

    function changeLanguage() {
        preferences.setLanguage(languageSelect.value);
        languageSelect.removeAttribute('aria-invalid');
        locale = preferences.locale();
        renderLabels();
        var event = document.createEvent('Event');
        event.initEvent('birdweather-language', false, false);
        document.dispatchEvent(event);
    }

    document.addEventListener('birdweather-blackout', function () {
        abortSearch();
        if (statusKey === 'searchingStations') {
            setStatus('');
        }
    });
    searchForm.addEventListener('submit', search);
    locationButton.addEventListener('click', requestLocation);
    stationModeButton.addEventListener('click', function () { selectSource('station'); });
    searchInput.addEventListener('input', function () {
        if (searchInput.value.trim() !== draft.station) {
            draft.station = '';
            selectedName = '';
            stationSelected = false;
            setStatus('');
            renderSelection();
        }
    });
    latitude.addEventListener('input', enterCoordinates);
    longitude.addEventListener('input', enterCoordinates);
    viewTodayButton.addEventListener('click', function () { chooseView('today'); });
    viewLatestButton.addEventListener('click', function () { chooseView('latest'); });
    limitSelect.addEventListener('change', function () { limitSelect.removeAttribute('aria-invalid'); });
    radiusSelect.addEventListener('change', function () { radiusSelect.removeAttribute('aria-invalid'); });
    languageSelect.addEventListener('change', changeLanguage);
    openButton.addEventListener('click', function () {
        openSetup(true);
    });
    saveButton.addEventListener('click', saveSetup);
    nightEnabled.addEventListener('change', function () {
        nightEnabled.removeAttribute('aria-invalid');
        changeNight();
    });
    nightStart.addEventListener('change', changeNight);
    nightEnd.addEventListener('change', changeNight);

    for (var cap = 1; cap <= 32; cap += 1) {
        var option = document.createElement('option');
        option.value = option.textContent = String(cap);
        limitSelect.appendChild(option);
    }

    if (config && savedNight) {
        openButton.setAttribute('aria-label', say('settingsTitle'));
    } else {
        openSetup(false);
    }
}(window, document));
