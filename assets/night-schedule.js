(function (window) {
    'use strict';

    function validTime(value) {
        return typeof value === 'string' && value.length === 5 && /^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/.test(value);
    }

    function create(enabled, start, end) {
        if (enabled === false && start === null && end === null) {
            return { enabled: false, start: null, end: null };
        }
        if (typeof enabled !== 'boolean' || !validTime(start) || !validTime(end) || start === end) {
            return null;
        }
        return { enabled: enabled, start: start, end: end };
    }

    function fromAddress(flag, start, end) {
        if (flag !== '1' && flag !== '0') {
            return null;
        }
        return create(flag === '1', start, end);
    }

    function toQuery(schedule) {
        var query = schedule.enabled ? '&night=1' : '&night=0';
        return schedule.start ? query + '&nightStart=' + encodeURIComponent(schedule.start) +
            '&nightEnd=' + encodeURIComponent(schedule.end) : query;
    }

    window.BirdWeatherNight = {
        validTime: validTime,
        create: create,
        fromAddress: fromAddress,
        toQuery: toQuery
    };
}(window));
