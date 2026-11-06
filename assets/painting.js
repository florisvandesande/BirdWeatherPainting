(function (window, document) {
    'use strict';

    var api = window.BirdWeatherApi;
    var text = window.BirdWeatherText;
    var languages = window.navigator.languages;
    var locale = text.localeFor(languages && languages.length ? languages : [window.navigator.language || 'en']);
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
    var stationId = readStationId();
    var hasLoaded = false;
    var request = null;
    var refreshTimer = null;
    var hiddenProperty = 'hidden' in document ? 'hidden' : 'webkitHidden';
    var visibilityEvent = hiddenProperty === 'hidden' ? 'visibilitychange' : 'webkitvisibilitychange';

    function say(key, fields) {
        return text.message(locale, key, fields);
    }

    function readStationId() {
        var parameter = /(?:^\?|&)station(?:=([^&]*))?(?:&|$)/.exec(window.location.search);
        if (!parameter) {
            return null;
        }
        try {
            return decodeURIComponent(parameter[1] || '');
        } catch (error) {
            return '';
        }
    }

    function showStationHelp(state) {
        title.textContent = say(state);
        detail.textContent = say(state + 'Detail', { example: '?station=123' });
    }

    function setText(element, value) {
        if (element.textContent !== value) {
            element.textContent = value;
        }
    }

    function setConnectionStatus(state) {
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
        artwork.paint(image, observation && observation.species, function (credit) {
            artworkInfo.setDisplayed(credit ? [credit] : []);
        });
        setText(stationName, result.stationName);
        detail.className = observation ? 'scientific-name' : '';
        if (!observation) {
            setText(title, say('emptyDay'));
            title.removeAttribute('lang');
            setText(detail, say('emptyDetail'));
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
        var currentStationDate = new Date(Date.now() + observation.offsetMinutes * 60000).toISOString().slice(0, 10);
        var older = observation.timestamp.slice(0, 10) < currentStationDate;
        observationNote.hidden = !older;
        setText(observationNote, older ? say('older') : '');
    }

    function refresh() {
        if (!stationId || document[hiddenProperty] || request) {
            return;
        }
        request = api.latestForStation(stationId, function (error, result) {
            request = null;
            if (error === 'notFound' && !hasLoaded) {
                stationId = null;
                setConnectionStatus(null);
                showStationHelp('invalidStation');
                return;
            }
            if (!error) {
                hasLoaded = true;
                showLatest(result);
            } else if (!hasLoaded) {
                setText(title, say('connectionTitle'));
            }
            setConnectionStatus(error ? 'unavailable' : null);
            refreshTimer = window.setTimeout(refresh, 120000);
        });
    }

    function visibilityChanged() {
        if (!stationId) {
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

    document.documentElement.lang = locale;
    artworkInfo.setLocale(locale);
    document.title = say('title');
    document.querySelector('[data-text="title"]').textContent = document.title;
    title.textContent = say('loading');
    if (stationId === null) {
        showStationHelp('missingStation');
    } else if (!api.validStationId(stationId)) {
        showStationHelp('invalidStation');
    } else {
        document.addEventListener(visibilityEvent, visibilityChanged);
        if (document[hiddenProperty]) {
            setConnectionStatus('paused');
        } else {
            refresh();
        }
    }
}(window, document));
