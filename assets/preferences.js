(function (window) {
    'use strict';

    var api = window.BirdWeatherApi;
    var text = window.BirdWeatherText;
    var setupKey = 'birdweather.setup';
    var languageKey = 'birdweather.language';
    var savedLanguage = readLocal(languageKey);
    var languageChoice = text.supportsLocale(savedLanguage) ? savedLanguage : 'auto';

    function parameter(name) {
        var match = new RegExp('(?:^\\?|&)' + name + '(?:=([^&]*))?(?:&|$)').exec(window.location.search);
        if (!match) {
            return null;
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

    function save(config) {
        var selected = stationConfig(config.source, config.station);
        if (selected) {
            writeLocal(setupKey, selected);
            window.location.assign('?source=station&station=' + encodeURIComponent(selected.station));
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
        parameter: parameter,
        hasSourceParameter: hasSourceParameter,
        getLanguage: getLanguage,
        setLanguage: setLanguage,
        locale: locale
    };
}(window));
