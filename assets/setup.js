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
        saveButton.disabled = !api.validStationId(station);
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

    function openSetup(moveFocus) {
        draft = { source: 'station', station: config && config.station };
        selectedName = '';
        searchInput.value = '';
        results = [];
        statusKey = !config && preferences.hasSourceParameter() ? 'stationAddressInvalid' : '';
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
    languageSelect.addEventListener('change', changeLanguage);
    openButton.addEventListener('click', function () {
        openSetup(true);
    });
    backButton.addEventListener('click', closeSetup);
    saveButton.addEventListener('click', function () {
        preferences.save(draft);
    });

    if (config) {
        openButton.textContent = say('settingsTitle');
        painting.hidden = false;
    } else {
        openSetup(false);
    }
}(window, document));
