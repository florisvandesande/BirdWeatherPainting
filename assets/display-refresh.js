(function (window, document) {
    'use strict';

    function minutes(time) {
        return Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
    }

    function start(schedule, load, render, setStatus, checkDay) {
        var hiddenProperty = 'hidden' in document ? 'hidden' : 'webkitHidden';
        var visibilityEvent = hiddenProperty === 'hidden' ? 'visibilitychange' : 'webkitvisibilitychange';
        var startMinute = schedule.enabled ? minutes(schedule.start) : 0;
        var endMinute = schedule.enabled ? minutes(schedule.end) : 0;
        var root = document.documentElement;
        var blackedOut = false;
        var pending = null;
        var refreshTimer;
        var clockTimer;

        function pauseRefresh() {
            window.clearTimeout(refreshTimer);
            if (pending) {
                var attempt = pending;
                pending = null;
                if (attempt.request) {
                    attempt.request.abort();
                }
            }
        }

        function checkNight(now) {
            var minute = now.getHours() * 60 + now.getMinutes();
            var inNight = schedule.enabled && (startMinute < endMinute ?
                minute >= startMinute && minute < endMinute : minute >= startMinute || minute < endMinute);
            if (inNight) {
                if (!blackedOut) {
                    blackedOut = true;
                    root.classList.add('night-display');
                    var event = document.createEvent('Event');
                    event.initEvent('birdweather-blackout', false, false);
                    document.dispatchEvent(event);
                }
                pauseRefresh();
            }
            return inNight;
        }

        function refresh() {
            window.clearTimeout(refreshTimer);
            if (checkNight(new Date()) || document[hiddenProperty] || pending) {
                return;
            }
            if (checkDay) {
                checkDay(new Date());
            }
            var attempt = {};
            pending = attempt;
            attempt.request = load(function (error, result) {
                // Ignore a request that was cancelled even if its callback was already queued.
                if (pending !== attempt) {
                    return;
                }
                pending = null;
                var now = new Date();
                if (checkNight(now) || document[hiddenProperty]) {
                    return;
                }

                if (checkDay && checkDay(now)) {
                    refresh();
                    return;
                }
                var repeat = render(error, result);
                if (blackedOut) {
                    // Keep the screen black until the wake refresh succeeds or shows its failure state.
                    blackedOut = false;
                    root.classList.remove('night-display');
                }
                if (repeat !== false) {
                    refreshTimer = window.setTimeout(refresh, 120000);
                }
            });
        }

        function updateClock() {
            var now = new Date();
            window.clearTimeout(clockTimer);
            if ((schedule.enabled || checkDay) && !document[hiddenProperty]) {
                // Read the local clock at each minute boundary to account for clock changes.
                clockTimer = window.setTimeout(clockTick, 60000 - now.getSeconds() * 1000 - now.getMilliseconds());
            }
            return checkNight(now);
        }

        function clockTick() {
            if (updateClock() || document[hiddenProperty]) {
                return;
            }
            var changedDay = checkDay && checkDay(new Date());
            if (changedDay) {
                pauseRefresh();
            }
            if (changedDay || blackedOut) {
                refresh();
            }
        }

        function visibilityChanged() {
            var inNight = updateClock();
            if (document[hiddenProperty]) {
                pauseRefresh();
                setStatus('paused');
            } else if (!inNight) {
                setStatus('refreshing');
                refresh();
            }
        }

        document.addEventListener(visibilityEvent, visibilityChanged);
        window.addEventListener('pagehide', function () {
            window.clearTimeout(clockTimer);
            pauseRefresh();
        });
        window.addEventListener('pageshow', function (event) {
            if (event.persisted) {
                visibilityChanged();
            }
        });

        var inNight = updateClock();
        if (document[hiddenProperty]) {
            setStatus('paused');
        } else if (!inNight) {
            refresh();
        }
    }

    window.BirdWeatherDisplayRefresh = { start: start };
}(window, document));
