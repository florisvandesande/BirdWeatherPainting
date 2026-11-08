(function (window) {
    'use strict';

    var api = window.BirdWeatherApi;
    var text = window.BirdWeatherText;
    var night = window.BirdWeatherNight;
    var parameterNames = [
        'source', 'station', 'lat', 'lon', 'radius', 'view', 'limit', 'lang',
        'night', 'nightStart', 'nightEnd'
    ];
    var languageChoice;

    function decode(value) {
        try {
            return decodeURIComponent(value.replace(/\+/g, ' '));
        } catch (error) {
            return null;
        }
    }

    function parameters() {
        var values = Object.create(null);
        var query = window.location.search.replace(/^\?/, '');
        if (!query) {
            return values;
        }
        query.split('&').forEach(function (part) {
            if (!part) {
                return;
            }
            var separator = part.indexOf('=');
            var encodedName = separator === -1 ? part : part.slice(0, separator);
            var encodedValue = separator === -1 ? '' : part.slice(separator + 1);
            var name = decode(encodedName);
            if (parameterNames.indexOf(name) === -1) {
                return;
            }
            if (!values[name]) {
                values[name] = [];
            }
            values[name].push({ raw: decode(encodedValue), encoded: encodedValue });
        });
        return values;
    }

    var rawParameters = parameters();

    function field(name) {
        var values = rawParameters[name] || [];
        var first = values.length ? values[0] : null;
        return {
            present: values.length > 0,
            duplicate: values.length > 1,
            raw: first && first.raw !== null ? first.raw : '',
            malformed: Boolean(first && first.raw === null)
        };
    }

    function validRadius(value) {
        return value === '2' || value === '5' || value === '10';
    }

    function validLimit(value) {
        return typeof value === 'string' && /^(?:[2-9]|[12][0-9]|3[0-2])$/.test(value);
    }

    function roundCoordinate(value) {
        var rounded = Math.round((value + (value < 0 ? -1 : 1) * 2.220446049250313e-16) * 100000) / 100000;
        return rounded === 0 ? 0 : rounded;
    }

    function coordinate(value, limit) {
        var number = typeof value === 'string' && /^[-+]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)$/.test(value) ?
            Number(value) : NaN;
        return isFinite(number) && number >= -limit && number <= limit ? {
            valid: true,
            value: roundCoordinate(number)
        } : { valid: false, value: null };
    }

    function parseState() {
        var source = field('source');
        var station = field('station');
        var latitude = field('lat');
        var longitude = field('lon');
        var radiusField = field('radius');
        var view = field('view');
        var limit = field('limit');
        var language = field('lang');
        var nightFlag = field('night');
        var start = field('nightStart');
        var end = field('nightEnd');
        var stationValid = !station.duplicate && !station.malformed && api.validStationId(station.raw);
        var latitudeValue = coordinate(latitude.raw, 90);
        var longitudeValue = coordinate(longitude.raw, 180);
        var radiusValid = !radiusField.duplicate && !radiusField.malformed && validRadius(radiusField.raw);
        var viewValid = !view.duplicate && !view.malformed && (view.raw === 'latest' || view.raw === 'today');
        var limitValid = !limit.duplicate && !limit.malformed && validLimit(limit.raw);
        var languageValid = !language.duplicate && !language.malformed &&
            (language.raw === 'auto' || text.supportsLocale(language.raw));
        var nightSchedule = null;
        var nightValid = false;
        var sourceValue = !source.duplicate && !source.malformed ? source.raw : '';
        var sourceValid = source.present && !source.duplicate && !source.malformed &&
            (sourceValue === 'station' || sourceValue === 'nearby');
        var mixedSource = sourceValue === 'station' && (latitude.present || longitude.present || radiusField.present) ||
            sourceValue === 'nearby' && station.present;

        if (nightFlag.present && !nightFlag.duplicate && !nightFlag.malformed) {
            if (nightFlag.raw === '0') {
                nightSchedule = night.create(false, null, null);
                nightValid = Boolean(nightSchedule);
            } else if (nightFlag.raw === '1' && !start.duplicate && !end.duplicate &&
                    !start.malformed && !end.malformed) {
                nightSchedule = night.create(true, start.raw, end.raw);
                nightValid = Boolean(nightSchedule);
            }
        }

        var sourceDataValid = !mixedSource && (sourceValue === 'station' ? stationValid : sourceValue === 'nearby' &&
            !latitude.duplicate && !longitude.duplicate && latitudeValue.valid && longitudeValue.valid && radiusValid);
        var hasKnownParameter = parameterNames.some(function (name) {
            return field(name).present;
        });
        var complete = sourceValid && sourceDataValid && viewValid && limitValid && languageValid &&
            nightFlag.present && nightValid;
        var issues = [];

        if (hasKnownParameter && !sourceValid) {
            issues.push('source');
        }
        if (mixedSource) {
            issues.push('source');
        }
        if (sourceValue === 'station' && !stationValid) {
            issues.push('station');
        }
        if (sourceValue === 'nearby') {
            if (!latitudeValue.valid || latitude.duplicate || latitude.malformed) {
                issues.push('lat');
            }
            if (!longitudeValue.valid || longitude.duplicate || longitude.malformed) {
                issues.push('lon');
            }
            if (!radiusValid) {
                issues.push('radius');
            }
        }
        if (!viewValid) {
            issues.push('view');
        }
        if (!limitValid) {
            issues.push('limit');
        }
        if (!languageValid) {
            issues.push('lang');
        }
        if (!nightFlag.present || !nightValid) {
            issues.push('night');
        }

        return {
            source: sourceValue,
            station: station,
            stationValid: stationValid,
            latitude: latitude,
            longitude: longitude,
            latitudeValue: latitudeValue,
            longitudeValue: longitudeValue,
            radius: radiusField,
            radiusValid: radiusValid,
            view: view,
            viewValid: viewValid,
            limit: limit,
            limitValid: limitValid,
            language: language,
            languageValid: languageValid,
            nightFlag: nightFlag,
            nightStart: start,
            nightEnd: end,
            night: nightSchedule,
            nightValid: nightValid,
            hasKnownParameter: hasKnownParameter,
            complete: complete,
            issues: issues
        };
    }

    var state = parseState();
    languageChoice = state.languageValid ? state.language.raw : 'auto';

    function parameter(name, unique) {
        var value = field(name);
        if (!value.present) {
            return null;
        }
        if (unique && value.duplicate) {
            return '';
        }
        return value.raw;
    }

    function hasSourceParameter() {
        return ['source', 'station', 'lat', 'lon', 'radius'].some(function (name) {
            return field(name).present;
        });
    }

    function displayOptions(view, limit) {
        return {
            view: view === 'today' ? 'today' : 'latest',
            limit: validLimit(limit) ? limit : '12'
        };
    }

    function readDisplay() {
        return displayOptions(state.viewValid ? state.view.raw : '', state.limitValid ? state.limit.raw : '');
    }

    function nearbyDraft() {
        var selected = state.source === 'nearby';
        return {
            selected: selected,
            radius: state.radiusValid ? state.radius.raw : '2',
            coordinates: state.latitudeValue.valid && state.longitudeValue.valid ? {
                lat: state.latitudeValue.value,
                lon: state.longitudeValue.value
            } : null,
            latitude: state.latitude.raw,
            longitude: state.longitude.raw
        };
    }

    function stationDraft() {
        return state.station.raw;
    }

    function read() {
        if (!state.complete) {
            return null;
        }
        if (state.source === 'nearby') {
            return {
                source: 'nearby',
                radius: state.radius.raw,
                coordinates: { lat: state.latitudeValue.value, lon: state.longitudeValue.value }
            };
        }
        return { source: 'station', station: state.station.raw };
    }

    function readNight() {
        if (!state.nightFlag.present) {
            return night.create(false, null, null);
        }
        return state.nightValid ? state.night : null;
    }

    function nightInvalid() {
        return state.nightFlag.present && !state.nightValid;
    }

    function statusKey() {
        if (!state.hasKnownParameter) {
            return '';
        }
        if (state.source === 'nearby') {
            var missingCoordinate = !state.latitude.present || !state.longitude.present;
            var invalidCoordinate = (state.latitude.present && !state.latitudeValue.valid) ||
                (state.longitude.present && !state.longitudeValue.valid);
            if (missingCoordinate) {
                return 'locationRequired';
            }
            if (invalidCoordinate) {
                return 'coordinateInvalid';
            }
            if (!state.radiusValid) {
                return 'radiusInvalid';
            }
            return state.issues.length ? 'urlInvalid' : '';
        }
        if (state.source === 'station' && !state.stationValid) {
            return 'stationAddressInvalid';
        }
        return state.issues.length ? 'urlInvalid' : '';
    }

    function canonicalCoordinate(value) {
        return String(roundCoordinate(Number(value)));
    }

    function validLanguage(value) {
        return value === 'auto' || text.supportsLocale(value);
    }

    function save(config) {
        var display = displayOptions(config.view, config.limit);
        var language = validLanguage(config.language) ? config.language : languageChoice;
        var schedule = config.night && night.create(config.night.enabled, config.night.start, config.night.end);
        var query = '?';
        if (!schedule || !validLanguage(language)) {
            return false;
        }
        if (config.source === 'nearby' && api.validCoordinates(config.coordinates) && validRadius(config.radius)) {
            query += 'source=nearby&lat=' + canonicalCoordinate(config.coordinates.lat) +
                '&lon=' + canonicalCoordinate(config.coordinates.lon) + '&radius=' + config.radius;
        } else if (config.source === 'station' && api.validStationId(config.station)) {
            query += 'source=station&station=' + encodeURIComponent(config.station);
        } else {
            return false;
        }
        query += '&view=' + display.view + '&limit=' + display.limit + '&lang=' + encodeURIComponent(language);
        query += '&night=' + (schedule.enabled ? '1' : '0');
        if (schedule.enabled) {
            query += '&nightStart=' + encodeURIComponent(schedule.start) + '&nightEnd=' + encodeURIComponent(schedule.end);
        }
        window.location.assign(query);
        return true;
    }

    function getLanguage() {
        return languageChoice;
    }

    function setLanguage(value) {
        if (!validLanguage(value)) {
            return false;
        }
        languageChoice = value;
        return true;
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
        readDisplay: readDisplay,
        nearbyDraft: nearbyDraft,
        stationDraft: stationDraft,
        save: save,
        readNight: readNight,
        nightInvalid: nightInvalid,
        statusKey: statusKey,
        parameter: parameter,
        hasSourceParameter: hasSourceParameter,
        getLanguage: getLanguage,
        setLanguage: setLanguage,
        locale: locale
    };
}(window));
