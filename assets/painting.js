(function (window, document) {
    'use strict';

    var api = window.BirdWeatherApi;
    var text = window.BirdWeatherText;
    var preferences = window.BirdWeatherPreferences;
    var config = preferences.read();
    var locale = preferences.locale();
    var title = document.getElementById('plate-title');
    var detail = document.getElementById('plate-detail');
    var image = document.getElementById('latest-art');
    var artwork = window.BirdWeatherArtwork;
    var artworkInfo = window.BirdWeatherArtworkInfo;
    var stationName = document.getElementById('station-name');
    var detectionTime = document.getElementById('detection-time');
    var time = detectionTime.getElementsByTagName('time')[0];
    var observationNote = document.getElementById('observation-note');
    var connectionStatus = document.getElementById('connection-status');
    var sourceActive = Boolean(config);
    var nearby = config && config.source === 'nearby';
    var lastResult = null;
    var connectionState = null;
    var request = null;
    var refreshTimer = null;
    var hiddenProperty = 'hidden' in document ? 'hidden' : 'webkitHidden';
    var visibilityEvent = hiddenProperty === 'hidden' ? 'visibilitychange' : 'webkitvisibilitychange';

    function say(key, fields) {
        return text.message(locale, key, fields);
    }

    function showStationHelp(state) {
        title.textContent = say(state);
        detail.textContent = say(state + 'Detail');
    }

    function setText(element, value) {
        if (element.textContent !== value) {
            element.textContent = value;
        }
    }

    function setConnectionStatus(state) {
        connectionState = state;
        setText(connectionStatus, state ? say(state) : '');
    }

    function translatedName(species) {
        var localizedName;
        for (var index = 0; index < species.translations.length; index += 1) {
            var translation = species.translations[index];
            if (translation && typeof translation.commonName === 'string' &&
                    translation.commonName.length <= 160 && translation.commonName.trim()) {
                if (translation.locale === 'nl') {
                    return { name: translation.commonName.trim(), language: 'nl' };
                }
                if (translation.locale === locale) {
                    localizedName = translation.commonName.trim();
                }
            }
        }
        if (localizedName) {
            return { name: localizedName, language: locale };
        }
        return { name: species.commonName, language: 'en' };
    }

    function showLatest(result) {
        var observation = result.observation;
        var heading = nearby ?
            say(result.stationName ? 'nearbyDetectionHeading' : 'nearbyHeading',
                { radius: config.radius, name: result.stationName }) : result.stationName;
        setText(stationName, heading);
        detail.className = observation ? 'scientific-name' : '';
        if (!observation) {
            var emptyState = nearby ? (result.hasStations ? 'nearbyEmpty' : 'nearbyNoStations') : 'emptyDay';
            var emptyDetail = nearby ? emptyState + 'Detail' : 'emptyDetail';
            setText(title, say(emptyState));
            title.removeAttribute('lang');
            setText(detail, say(emptyDetail));
            detectionTime.hidden = true;
            observationNote.hidden = true;
            return;
        }
        var common = translatedName(observation.species);
        setText(title, common.name);
        title.setAttribute('lang', common.language);
        setText(detail, observation.species.scientificName);
        detectionTime.hidden = false;
        time.setAttribute('datetime', observation.timestamp);
        setText(time, say('observed', { time: text.formatDate(locale, observation), zone: observation.zone }));
        var now = new Date();
        var heard = new Date(observation.time);
        // Nearby observations can span time zones. Compare days in the device's calendar.
        var older = nearby ? heard < now && heard.toDateString() !== now.toDateString() :
            observation.timestamp.slice(0, 10) <
                new Date(now.getTime() + observation.offsetMinutes * 60000).toISOString().slice(0, 10);
        observationNote.hidden = !older;
        setText(observationNote, older ? say('older') : '');
    }

    function refresh() {
        if (!sourceActive || document[hiddenProperty] || request) {
            return;
        }
        request = api.latestForSource(config, function (error, result) {
            request = null;
            if (error === 'notFound' && !lastResult) {
                sourceActive = false;
                setConnectionStatus(null);
                showStationHelp('invalidStation');
                return;
            }
            if (!error) {
                lastResult = result;
                showLatest(result);
                artwork.paint(image, result.observation && result.observation.species, function (credit) {
                    artworkInfo.setDisplayed(credit ? [credit] : []);
                });
            } else if (!lastResult) {
                setText(title, say('connectionTitle'));
            }
            setConnectionStatus(error ? 'unavailable' : null);
            refreshTimer = window.setTimeout(refresh, 120000);
        });
    }

    function visibilityChanged() {
        if (!sourceActive) {
            return;
        }
        window.clearTimeout(refreshTimer);
        if (document[hiddenProperty]) {
            if (request) {
                request.abort();
                request = null;
            }
            setConnectionStatus('paused');
        } else {
            setConnectionStatus('refreshing');
            refresh();
        }
    }

    function renderLocale() {
        locale = preferences.locale();
        document.documentElement.lang = locale;
        document.title = say('title');
        setText(document.querySelector('#painting [data-text="title"]'), document.title);
        setConnectionStatus(connectionState);
        if (lastResult) {
            showLatest(lastResult);
        } else if (config && !sourceActive) {
            showStationHelp('invalidStation');
        } else {
            setText(stationName, nearby ? say('nearbyHeading', { radius: config.radius }) : '');
            setText(title, say(connectionState === 'unavailable' ? 'connectionTitle' : 'loading'));
        }
    }

    artworkInfo.setLocale(locale);
    document.addEventListener('birdweather-language', renderLocale);
    renderLocale();
    if (sourceActive) {
        document.addEventListener(visibilityEvent, visibilityChanged);
        if (document[hiddenProperty]) {
            setConnectionStatus('paused');
        } else {
            refresh();
        }
    }
}(window, document));
