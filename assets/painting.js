(function (window, document) {
    'use strict';

    var api = window.BirdWeatherApi;
    var text = window.BirdWeatherText;
    var preferences = window.BirdWeatherPreferences;
    var config = preferences.read();
    var locale = preferences.locale();
    var painting = document.getElementById('painting');
    var title = document.getElementById('plate-title');
    var detail = document.getElementById('plate-detail');
    var image = document.getElementById('latest-art');
    var artwork = window.BirdWeatherArtwork;
    var artworkInfo = window.BirdWeatherArtworkInfo;
    var observationNote = document.getElementById('observation-note');
    var connectionStatus = document.getElementById('connection-status');
    var sourceActive = Boolean(config);
    var nearby = config && config.source === 'nearby';
    var schedule = preferences.readNight();
    var display = preferences.readDisplay();
    var collageSource = config && display.view === 'today' && window.BirdWeatherCollageData.create(config, display.limit);
    var collageView = collageSource && window.BirdWeatherCollageView.create();
    var emptyArtworkDate = null;
    var emptyArtworkCredit = null;
    var lastResult = null;
    var connectionState = null;

    function say(key, fields) {
        return text.message(locale, key, fields);
    }

    function showStationHelp(state) {
        title.classList.remove('is-loading');
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

    function emptyState(result) {
        if (nearby) {
            return result.hasStations ? 'nearbyEmpty' : 'nearbyNoStations';
        }
        return 'emptyDay';
    }

    function showLatest(result) {
        var observation = result.observation;
        title.classList.remove('is-loading');
        detail.className = observation ? 'scientific-name' : '';
        if (!observation) {
            setText(title, say('perch'));
            title.removeAttribute('lang');
            setText(detail, say('emptyBranch'));
            observationNote.hidden = false;
            setText(observationNote, say(emptyState(result)));
            return;
        }
        var common = text.speciesName(locale, observation.species);
        setText(title, common.name);
        title.setAttribute('lang', common.language);
        setText(detail, observation.species.scientificName);
        var now = new Date();
        var heard = new Date(observation.time);
        // Nearby observations can span time zones. Compare days in the device's calendar.
        var older = nearby ? heard < now && heard.toDateString() !== now.toDateString() :
            observation.timestamp.slice(0, 10) <
                new Date(now.getTime() + observation.offsetMinutes * 60000).toISOString().slice(0, 10);
        observationNote.hidden = !older;
        setText(observationNote, older ? say('older') : '');
    }

    function load(complete) {
        if (!sourceActive) {
            complete('notFound');
            return null;
        }
        return collageSource ? collageSource.load(complete) : api.latestForSource(config, complete);
    }

    function showCollage(result) {
        collageView.show(result, locale);
        if (!result.species.length) {
            var state = nearby && !result.hasStations ? 'nearbyNoStations' : 'collageEmpty';
            detail.className = '';
            collageView.showEmpty(locale);
            observationNote.hidden = false;
            setText(observationNote, say(state));
        } else {
            observationNote.hidden = true;
        }
    }

    function showLoading() {
        title.classList.add('is-loading');
        detail.className = '';
        setText(detail, '');
        setText(title, say('loading'));
        artwork.paint(image, null, setPlateCredit);
    }

    function checkDay(now) {
        if (!sourceActive || !collageSource.checkDay(now.getTime())) {
            return false;
        }
        lastResult = null;
        emptyArtworkDate = null;
        emptyArtworkCredit = null;
        collageView.clear();
        showLoading();
        setConnectionStatus('refreshing');
        return true;
    }

    function showConnectionProblem(state) {
        title.classList.remove('is-loading');
        if (state === 'collageZoneUnavailable') {
            showStationHelp('collageZone');
        } else {
            setText(title, say('connectionTitle'));
        }
    }

    function setPlateCredit(credit) {
        artworkInfo.setDisplayed(credit ? [credit] : []);
    }

    function paintEmptyCollage(date) {
        if (emptyArtworkDate === date) {
            setPlateCredit(emptyArtworkCredit);
            return;
        }
        emptyArtworkDate = date;
        emptyArtworkCredit = null;
        collageView.paintEmpty(function (credit) {
            if (emptyArtworkDate === date) {
                emptyArtworkCredit = credit;
                setPlateCredit(credit);
            }
        });
    }

    function renderResult(error, result) {
        if (error === 'notFound' && !lastResult) {
            sourceActive = false;
            setConnectionStatus(null);
            showStationHelp('invalidStation');
            return false;
        }
        if (!error) {
            lastResult = result;
            if (collageView) {
                showCollage(result);
                if (!result.species.length) {
                    paintEmptyCollage(result.date);
                }
            } else {
                showLatest(result);
                artwork.paint(image, result.observation && result.observation.species, setPlateCredit);
            }
        } else if (!lastResult) {
            showConnectionProblem(error);
        }
        var status = error ? (error === 'collageZoneUnavailable' ? error : 'unavailable') : null;
        if (!error) {
            if (collageView && !result.species.length) {
                status = nearby && !result.hasStations ? 'nearbyNoStationsDetail' : 'collageEmptyDetail';
            } else if (!collageView && !result.observation) {
                var state = emptyState(result);
                status = nearby ? state + 'Detail' : 'emptyDetail';
            }
        }
        setConnectionStatus(status);
    }

    function renderLocale() {
        locale = preferences.locale();
        document.documentElement.lang = locale;
        document.title = say('title');
        setConnectionStatus(connectionState);
        if (lastResult) {
            if (collageView) {
                showCollage(lastResult);
            } else {
                showLatest(lastResult);
            }
        } else if (config && !sourceActive) {
            showStationHelp('invalidStation');
        } else if (connectionState === 'unavailable' || connectionState === 'collageZoneUnavailable') {
            showConnectionProblem(connectionState);
        } else {
            showLoading();
        }
    }

    artworkInfo.setLocale(locale);
    document.addEventListener('birdweather-language', renderLocale);
    renderLocale();
    if (sourceActive && schedule) {
        window.BirdWeatherDisplayRefresh.start(schedule, load, renderResult, setConnectionStatus, collageSource ? checkDay : null);
        painting.hidden = false;
    }
}(window, document));
