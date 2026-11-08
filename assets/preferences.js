(function (window) {
    'use strict';

    var api = window.BirdWeatherApi;
    var text = window.BirdWeatherText;
    var night = window.BirdWeatherNight;
    var knownParameters = {
        source: true,
        station: true,
        lat: true,
        lon: true,
        radius: true,
        view: true,
        limit: true,
        lang: true,
        night: true,
        nightStart: true,
        nightEnd: true
    };
    var defaults = {
        source: 'nearby',
        radius: '2',
        view: 'today',
        limit: '12',
        lang: 'auto',
        night: false,
        nightStart: '22:00',
        nightEnd: '07:00'
    };
    var values = Object.create(null);
    var errors = Object.create(null);
    var malformedQuery = false;
    var hasKnownQuery = false;
    var languageChoice = defaults.lang;

    function readQuery() {
        var query = window.location.search.replace(/^\?/, '');
        if (query.length > 8192) {
            malformedQuery = true;
            query = query.slice(0, 8192);
        }
        if (!query) {
            return;
        }
        query.split('&').forEach(function (part) {
            if (!part) {
                return;
            }
            var separator = part.indexOf('=');
            var rawName = separator < 0 ? part : part.slice(0, separator);
            var rawValue = separator < 0 ? '' : part.slice(separator + 1);
            var name;
            var value;
            try {
                name = decodeURIComponent(rawName.replace(/\+/g, ' '));
            } catch (error) {
                malformedQuery = true;
                return;
            }
            if (!Object.prototype.hasOwnProperty.call(knownParameters, name)) {
                return;
            }
            hasKnownQuery = true;
            try {
                value = decodeURIComponent(rawValue.replace(/\+/g, ' '));
            } catch (error) {
                value = '';
                malformedQuery = true;
            }
            if (Object.prototype.hasOwnProperty.call(values, name)) {
                errors[name] = true;
                malformedQuery = true;
            } else {
                values[name] = value;
            }
        });
    }

    function coordinate(value, field) {
        if (typeof value !== 'string' || !/^[-+]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)$/.test(value)) {
            errors[field] = true;
            return null;
        }
        var number = Number(value);
        var limit = field === 'lat' ? 90 : 180;
        if (!isFinite(number) || number < -limit || number > limit) {
            errors[field] = true;
            return null;
        }
        return number;
    }

    function field(name, validate, fallback) {
        if (!Object.prototype.hasOwnProperty.call(values, name) || errors[name]) {
            if (hasKnownQuery || errors[name]) {
                errors[name] = true;
            }
            return fallback;
        }
        var value = values[name];
        if (!validate(value)) {
            errors[name] = true;
            return fallback;
        }
        return value;
    }

    function parse() {
        readQuery();
        var result = {
            source: null,
            station: '',
            lat: null,
            lon: null,
            radius: defaults.radius,
            view: defaults.view,
            limit: defaults.limit,
            lang: defaults.lang,
            night: defaults.night,
            nightStart: defaults.nightStart,
            nightEnd: defaults.nightEnd,
            errors: errors,
            complete: false
        };

        if (Object.prototype.hasOwnProperty.call(values, 'source')) {
            result.source = field('source', function (value) {
                return value === 'station' || value === 'nearby';
            }, null);
        } else {
            result.source = defaults.source;
            if (hasKnownQuery) {
                errors.source = true;
            }
        }

        if (result.source === 'station') {
            result.station = field('station', api.validStationId, '');
            if (Object.prototype.hasOwnProperty.call(values, 'station') && !errors.station) {
                // Keep a valid station ID available for the setup summary.
                result.station = values.station;
            }
        } else if (result.source === 'nearby') {
            if (Object.prototype.hasOwnProperty.call(values, 'station') && api.validStationId(values.station)) {
                result.station = values.station;
            }
            if (hasKnownQuery) {
                result.lat = coordinate(values.lat, 'lat');
                result.lon = coordinate(values.lon, 'lon');
            }
            result.radius = field('radius', function (value) {
                return value === '2' || value === '5' || value === '10';
            }, defaults.radius);
        } else {
            if (Object.prototype.hasOwnProperty.call(values, 'station') && api.validStationId(values.station)) {
                result.station = values.station;
            }
            result.lat = coordinate(values.lat, 'lat');
            result.lon = coordinate(values.lon, 'lon');
            if (Object.prototype.hasOwnProperty.call(values, 'radius') &&
                    (values.radius === '2' || values.radius === '5' || values.radius === '10')) {
                result.radius = values.radius;
            }
        }

        result.view = field('view', function (value) {
            return value === 'latest' || value === 'today';
        }, defaults.view);
        result.limit = field('limit', function (value) {
            return /^(?:[1-9]|[12][0-9]|3[0-2])$/.test(value);
        }, defaults.limit);
        result.lang = field('lang', function (value) {
            return value === 'auto' || text.supportsLocale(value);
        }, defaults.lang);
        result.night = field('night', function (value) {
            return value === '1' || value === '0';
        }, '0') === '1';
        result.nightStart = field('nightStart', night.validTime, defaults.nightStart);
        result.nightEnd = field('nightEnd', night.validTime, defaults.nightEnd);
        if (result.nightStart === result.nightEnd) {
            errors.nightStart = true;
            errors.nightEnd = true;
            result.nightStart = defaults.nightStart;
            result.nightEnd = defaults.nightEnd;
        }

        languageChoice = result.lang;
        result.complete = !malformedQuery && !Object.keys(errors).some(function (key) { return errors[key]; });
        if (result.source === 'station' && !api.validStationId(result.station)) {
            result.complete = false;
        }
        if (result.source === 'nearby' && (!api.validCoordinates({ lat: result.lat, lon: result.lon }) ||
                errors.radius)) {
            result.complete = false;
        }
        if (!result.source) {
            result.complete = false;
        }
        return result;
    }

    var parsed = parse();

    function roundedCoordinate(value) {
        var rounded = Number(Number(value).toFixed(5));
        return String(rounded === 0 ? 0 : rounded);
    }

    function queryFor(config) {
        var parts = [];
        function add(name, value) {
            parts.push(encodeURIComponent(name) + '=' + encodeURIComponent(String(value)));
        }
        add('source', config.source);
        if (config.source === 'station') {
            add('station', config.station);
        } else {
            add('lat', roundedCoordinate(config.coordinates.lat));
            add('lon', roundedCoordinate(config.coordinates.lon));
            add('radius', config.radius);
        }
        add('view', config.view);
        add('limit', config.limit);
        add('lang', config.lang);
        add('night', config.night.enabled ? '1' : '0');
        add('nightStart', config.night.start);
        add('nightEnd', config.night.end);
        return parts.join('&');
    }

    function save(config) {
        var display = {
            view: config.view === 'today' ? 'today' : 'latest',
            limit: /^(?:[1-9]|[12][0-9]|3[0-2])$/.test(String(config.limit)) ? String(config.limit) : defaults.limit
        };
        var schedule = config.night && night.create(config.night.enabled, config.night.start, config.night.end);
        if (!schedule || (config.source !== 'station' && config.source !== 'nearby')) {
            return false;
        }
        var normalized = {
            source: config.source,
            station: config.station,
            coordinates: config.coordinates,
            radius: config.radius,
            view: display.view,
            limit: display.limit,
            lang: config.lang === 'auto' || text.supportsLocale(config.lang) ? config.lang : 'auto',
            night: schedule
        };
        if (normalized.source === 'station' && !api.validStationId(normalized.station)) {
            return false;
        }
        if (normalized.source === 'nearby' && (!api.validCoordinates(normalized.coordinates) ||
                ['2', '5', '10'].indexOf(normalized.radius) < 0)) {
            return false;
        }
        window.location.assign(window.location.pathname + '?' + queryFor(normalized) + window.location.hash);
        return true;
    }

    function getLanguage() {
        return languageChoice;
    }

    function setLanguage(value) {
        if (value !== 'auto' && !text.supportsLocale(value)) {
            return false;
        }
        languageChoice = value;
        return true;
    }

    function resetLanguage() {
        languageChoice = parsed.lang;
    }

    function locale() {
        if (languageChoice !== 'auto') {
            return languageChoice;
        }
        var languages = window.navigator.languages;
        return text.localeFor(languages && languages.length ? languages : [window.navigator.language || 'en']);
    }

    function read() {
        if (!parsed.complete) {
            return null;
        }
        return parsed.source === 'nearby' ? {
            source: parsed.source,
            coordinates: { lat: parsed.lat, lon: parsed.lon },
            radius: parsed.radius
        } : { source: parsed.source, station: parsed.station };
    }

    function readNight() {
        return night.create(parsed.night, parsed.nightStart, parsed.nightEnd);
    }

    function draft() {
        return {
            source: parsed.source,
            station: parsed.station,
            lat: parsed.lat,
            lon: parsed.lon,
            radius: parsed.radius,
            view: parsed.view,
            limit: parsed.limit,
            lang: parsed.lang,
            night: parsed.night,
            nightStart: parsed.nightStart,
            nightEnd: parsed.nightEnd,
            errors: parsed.errors,
            complete: parsed.complete,
            hasKnownQuery: hasKnownQuery
        };
    }

    window.BirdWeatherPreferences = {
        read: read,
        readDisplay: function () { return { view: parsed.view, limit: parsed.limit }; },
        readNight: readNight,
        draft: draft,
        save: save,
        getLanguage: getLanguage,
        setLanguage: setLanguage,
        resetLanguage: resetLanguage,
        locale: locale
    };
}(window));
