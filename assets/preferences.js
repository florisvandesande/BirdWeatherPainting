(function (window) {
    'use strict';

    var api = window.BirdWeatherApi;
    var text = window.BirdWeatherText;
    var night = window.BirdWeatherNight;
    var setupKey = 'birdweather.setup';
    var languageKey = 'birdweather.language';
    var savedLanguage = readLocal(languageKey);
    var languageChoice = text.supportsLocale(savedLanguage) ? savedLanguage : 'auto';

    function parameter(name, unique) {
        var expression = new RegExp('(?:^\\?|&)' + name + '(?:=([^&]*))?(?=&|$)', 'g');
        var match = expression.exec(window.location.search);
        if (!match) {
            return null;
        }
        if (unique && expression.test(window.location.search)) {
            return '';
        }
        try {
            return decodeURIComponent(match[1] || '');
        } catch (error) {
            return '';
        }
    }

    function readLocal(key) {
        try {
            return JSON.parse(window.localStorage.getItem(key));
        } catch (error) {
            return null;
        }
    }

    function writeLocal(key, value) {
        try {
            window.localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            return false;
        }
    }

    function stationConfig(source, station) {
        return (source === 'station' || source === null) && api.validStationId(station) ?
            { source: 'station', station: station } : null;
    }

    function hasSourceParameter() {
        return parameter('source') !== null || parameter('station') !== null;
    }

    function read() {
        if (hasSourceParameter()) {
            return stationConfig(parameter('source'), parameter('station'));
        }
        var saved = readLocal(setupKey);
        return saved ? stationConfig(saved.source, saved.station) : null;
    }

    function readNight() {
        var flag = parameter('night', true);
        var start = parameter('nightStart', true);
        var end = parameter('nightEnd', true);
        if (flag !== null || start !== null || end !== null) {
            return night.fromAddress(flag, start, end);
        }

        var saved = !hasSourceParameter() && readLocal(setupKey);
        return saved && saved.night ? night.create(saved.night.enabled, saved.night.start, saved.night.end) :
            night.create(false, null, null);
    }

    function save(config) {
        var selected = stationConfig(config.source, config.station);
        var schedule = config.night && night.create(config.night.enabled, config.night.start, config.night.end);
        if (selected && schedule) {
            selected.night = schedule;
            writeLocal(setupKey, selected);
            window.location.assign('?source=station&station=' + encodeURIComponent(selected.station) +
                night.toQuery(selected.night));
        }
    }

    function getLanguage() {
        return languageChoice;
    }

    function setLanguage(value) {
        if (value !== 'auto' && !text.supportsLocale(value)) {
            return false;
        }
        languageChoice = value;
        return writeLocal(languageKey, value);
    }

    function locale() {
        if (languageChoice !== 'auto') {
            return languageChoice;
        }
        var languages = window.navigator.languages;
        return text.localeFor(languages && languages.length ? languages : [window.navigator.language || 'en']);
    }

    window.BirdWeatherPreferences = {
        read: read,
        save: save,
        readNight: readNight,
        parameter: parameter,
        hasSourceParameter: hasSourceParameter,
        getLanguage: getLanguage,
        setLanguage: setLanguage,
        locale: locale
    };
}(window));
