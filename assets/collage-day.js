(function (window) {
    'use strict';

    var data = window.BirdWeatherZoneData;

    function stationDate(time, zone) {
        if (!data || time < data.first || time >= data.end ||
                !Object.prototype.hasOwnProperty.call(data.zones, zone)) {
            return null;
        }
        var offsets = data.series[data.zones[zone]];
        var index = 0;
        while (index + 2 < offsets.length && offsets[index + 1] * 1000 <= time) {
            index += 2;
        }
        return new Date(time + offsets[index] * 1000).toISOString().slice(0, 10);
    }

    function deviceDate(time) {
        return new Date(time).toDateString();
    }

    function nearbyPeriod(now) {
        var local = new Date(now);
        local.setHours(0, 0, 0, 0);
        return { from: local.toISOString(), to: new Date(now).toISOString(), timezone: 'Etc/UTC' };
    }

    window.BirdWeatherCollageDay = { stationDate: stationDate, deviceDate: deviceDate, nearbyPeriod: nearbyPeriod };
}(window));
