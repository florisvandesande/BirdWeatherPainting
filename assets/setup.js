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
    var welcomeIntro = document.getElementById('welcome-intro');
    var openButton = document.getElementById('open-settings');
    var saveButton = document.getElementById('save-settings');
    var backButton = document.getElementById('cancel-settings');
    var searchForm = document.getElementById('station-search');
    var searchInput = document.getElementById('station-query');
    var searchStatus = document.getElementById('station-search-status');
    var resultList = document.getElementById('station-results');
    var languageSelect = document.getElementById('display-language');
    var languageStatus = document.getElementById('language-status');
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
        saveButton.disabled = !api.validStationId(station);
        if (selectedName) {
            selectionSummary.textContent = say('selectedStationName', { name: selectedName });
        } else {
            selectionSummary.textContent = station ? say('selectedStationId', { id: station }) : '';
        }
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

    function saveSettings() {
        var schedule = night.create(nightEnabled.checked, nightStart.value || null, nightEnd.value || null);
        if (!schedule && !nightEnabled.checked) {
            schedule = night.create(false, null, null);
        }
        if (!schedule) {
            var invalidField = night.validTime(nightStart.value) ? nightEnd : nightStart;
            invalidField.setAttribute('aria-invalid', 'true');
            nightStatusKey = 'invalid';
            renderNightStatus();
            invalidField.focus();
            return;
        }
        draft.night = schedule;
        preferences.save(draft);
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
        title.textContent = say(config ? 'settingsTitle' : 'welcomeTitle');
        saveButton.textContent = say(config ? 'saveSettings' : 'openPainting');
        openButton.textContent = say('settingsTitle');
        searchStatus.textContent = statusKey ? say(statusKey) : '';
        renderSelection();
        showResults(results);
    }

    function setStatus(key) {
        statusKey = key;
        searchStatus.textContent = key ? say(key) : '';
    }

    function abortSearch() {
        if (searchRequest) {
            var request = searchRequest.request;
            searchRequest = null;
            request.abort();
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
        if (document.documentElement.classList.contains('night-display')) {
            return;
        }
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
        var attempt = {};
        searchRequest = attempt;
        attempt.request = api.searchStations(term, function (error, stations) {
            if (searchRequest !== attempt) {
                return;
            }
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

    function openSetup(moveFocus) {
        draft = { source: 'station', station: config && config.station };
        selectedName = '';
        searchInput.value = '';
        results = [];
        statusKey = !config && preferences.hasSourceParameter() ? 'stationAddressInvalid' : '';
        languageSelect.value = preferences.getLanguage();
        welcomeIntro.hidden = Boolean(config);
        backButton.hidden = !config || !savedNight;
        nightEnabled.checked = savedNight ? savedNight.enabled : preferences.parameter('night') === '1';
        nightStart.value = savedNight ? savedNight.start || '22:00' : '';
        nightEnd.value = savedNight ? savedNight.end || '07:00' : '';
        changeNight();
        nightStatusKey = savedNight ? '' : 'invalidSaved';
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

    document.addEventListener('birdweather-blackout', function () {
        abortSearch();
        if (statusKey === 'searchingStations') {
            setStatus('');
        }
    });
    searchForm.addEventListener('submit', search);
    languageSelect.addEventListener('change', changeLanguage);
    openButton.addEventListener('click', function () {
        openSetup(true);
    });
    backButton.addEventListener('click', closeSetup);
    saveButton.addEventListener('click', saveSettings);
    nightEnabled.addEventListener('change', changeNight);
    nightStart.addEventListener('change', changeNight);
    nightEnd.addEventListener('change', changeNight);

    if (config && savedNight) {
        openButton.textContent = say('settingsTitle');
    } else {
        openSetup(false);
    }
}(window, document));
