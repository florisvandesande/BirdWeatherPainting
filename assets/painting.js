(function (window, document) {
    'use strict';

    var api = window.BirdWeatherApi;
    var text = window.BirdWeatherText;
    var preferences = window.BirdWeatherPreferences;
    var config = preferences.read();
    var locale = preferences.locale();
    var painting = document.getElementById('painting');
    var caption = document.querySelector('.plate-caption');
    var title = document.getElementById('plate-title');
    var detail = document.getElementById('plate-detail');
    var image = document.getElementById('latest-art');
    var artwork = window.BirdWeatherArtwork;
    var artworkInfo = window.BirdWeatherArtworkInfo;
    var sourceActive = Boolean(config);
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

    function setText(element, value) {
        if (element.textContent !== value) {
            element.textContent = value;
        }
    }

    function nameEmptyPainting() {
        detail.className = '';
        title.removeAttribute('lang');
        painting.removeAttribute('aria-labelledby');
        painting.setAttribute('aria-label', say('perch'));
        caption.hidden = true;
        setText(title, '');
        setText(detail, '');
    }

    function showStationHelp(state) {
        detail.className = '';
        title.removeAttribute('lang');
        painting.removeAttribute('aria-label');
        painting.setAttribute('aria-labelledby', 'plate-title');
        caption.hidden = false;
        title.textContent = say(state);
        detail.textContent = say(state + 'Detail');
    }

    function setConnectionStatus(state) {
        connectionState = state;
    }

    function showLatest(result) {
        var observation = result.observation;
        detail.className = observation ? 'scientific-name' : '';
        if (!observation) {
            nameEmptyPainting();
            return;
        }
        painting.removeAttribute('aria-label');
        painting.setAttribute('aria-labelledby', 'plate-title');
        caption.hidden = false;
        var common = text.speciesName(locale, observation.species);
        setText(title, common.name);
        title.setAttribute('lang', common.language);
        setText(detail, observation.species.scientificName);
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
            nameEmptyPainting();
            return;
        }
        caption.hidden = true;
    }

    function showLoading() {
        painting.removeAttribute('aria-labelledby');
        painting.setAttribute('aria-label', say('title'));
        detail.className = '';
        caption.hidden = true;
        setText(title, '');
        setText(detail, '');
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
        if (state === 'collageZoneUnavailable') {
            showStationHelp('collageZone');
        } else {
            detail.className = '';
            title.removeAttribute('lang');
            painting.removeAttribute('aria-label');
            painting.setAttribute('aria-labelledby', 'plate-title');
            caption.hidden = false;
            setText(title, say('connectionTitle'));
            setText(detail, say('unavailable'));
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
        artwork.paint(image, null, function (credit) {
            if (emptyArtworkDate === date) {
                emptyArtworkCredit = credit;
                if (lastResult && !lastResult.species.length) {
                    setPlateCredit(credit);
                }
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
        setConnectionStatus(error ? (error === 'collageZoneUnavailable' ? error : 'unavailable') : null);
    }

    function renderLocale() {
        locale = preferences.locale();
        document.documentElement.lang = locale;
        document.title = say('title');
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
