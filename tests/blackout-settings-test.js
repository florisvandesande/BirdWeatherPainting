(function (window, document) {
    'use strict';

    var status = document.getElementById('test-status');
    var frame = document.getElementById('app-under-test');
    var now = new Date();
    var start = new Date(now.getTime() - 10 * 60000);
    var end = new Date(now.getTime() + 10 * 60000);
    var requestCount = 0;

    function time(value) {
        var hours = String(value.getHours());
        var minutes = String(value.getMinutes());
        return (hours.length < 2 ? '0' : '') + hours + ':' + (minutes.length < 2 ? '0' : '') + minutes;
    }

    function check(condition, message) {
        if (!condition) {
            throw new Error(message);
        }
    }

    function setStatus(value) {
        status.textContent = value;
    }

    function fail(error) {
        status.setAttribute('data-result', 'fail');
        setStatus('Failed: ' + (error && error.message ? error.message : String(error)));
    }

    function controlledClock(appWindow) {
        var NativeDate = appWindow.Date;
        var current = new NativeDate();

        function TestDate() {
            var args = Array.prototype.slice.call(arguments);
            if (!(this instanceof TestDate)) {
                return new NativeDate(current.getTime()).toString();
            }
            if (!args.length) {
                return new NativeDate(current.getTime());
            }
            return new (Function.prototype.bind.apply(NativeDate, [null].concat(args)))();
        }

        TestDate.prototype = NativeDate.prototype;
        TestDate.now = function () { return current.getTime(); };
        TestDate.parse = NativeDate.parse;
        TestDate.UTC = NativeDate.UTC;
        appWindow.Date = TestDate;

        return function (value) {
            current = new NativeDate(value.getTime());
        };
    }

    function controlledApi(appWindow) {
        var NativeRequest = appWindow.XMLHttpRequest;
        var response = JSON.stringify({
            data: {
                station: {
                    id: '1',
                    name: 'Controlled test station',
                    detections: {
                        nodes: [{
                            timestamp: '2024-01-15T12:00:00Z',
                            species: {
                                id: '2',
                                commonName: 'Controlled Blackbird',
                                scientificName: 'Turdus merula',
                                translations: [],
                                imageUrl: '',
                                imageCredit: '',
                                imageLicense: '',
                                imageLicenseUrl: ''
                            }
                        }]
                    }
                }
            }
        });

        function Request() {
            this.native = new NativeRequest();
            this.status = 0;
            this.responseText = '';
            this.aborted = false;
            this.url = '';
        }

        Request.prototype.open = function (method, url, asynchronous) {
            this.url = url;
            this.native.open(method, url, asynchronous);
        };
        Request.prototype.setRequestHeader = function (name, value) {
            this.native.setRequestHeader(name, value);
        };
        Request.prototype.abort = function () {
            this.aborted = true;
            this.native.abort();
        };
        Request.prototype.send = function () {
            var request = this;
            if (request.url !== 'https://app.birdweather.com/graphql') {
                request.native.onload = function () {
                    request.status = request.native.status;
                    request.responseText = request.native.responseText;
                    if (request.onload) {
                        request.onload();
                    }
                };
                request.native.onerror = function () {
                    if (request.onerror) {
                        request.onerror();
                    }
                };
                request.native.send(arguments[0]);
                return;
            }
            requestCount += 1;
            appWindow.setTimeout(function () {
                if (request.aborted) {
                    return;
                }
                request.status = 200;
                request.responseText = response;
                request.onload();
            }, 0);
        };

        appWindow.XMLHttpRequest = Request;
    }

    function run() {
        var appWindow = frame.contentWindow;
        var appDocument = appWindow.document;
        var root = appDocument.documentElement;
        var blackoutButton = appDocument.getElementById('blackout-settings');
        var openButton = appDocument.getElementById('open-settings');
        var settings = appDocument.getElementById('setup');
        var painting = appDocument.getElementById('painting');
        var cancel = appDocument.getElementById('cancel-settings');
        var updateClock = controlledClock(appWindow);
        var inputEvent;
        var rect;
        var expired;

        controlledApi(appWindow);

        check(root.classList.contains('night-display'), 'The scheduled page did not start black.');
        check(blackoutButton && !blackoutButton.hidden, 'The black screen has no accessible Settings control.');
        check(blackoutButton.tagName === 'BUTTON' && blackoutButton.tabIndex >= 0,
            'The black screen control is not keyboard focusable.');
        check(openButton.getAttribute('aria-label') &&
            blackoutButton.getAttribute('aria-label') === openButton.getAttribute('aria-label'),
            'Configured night settings did not give the black screen the localized Settings name.');
        check(appWindow.getComputedStyle(root).backgroundColor === 'rgb(0, 0, 0)' &&
            appWindow.getComputedStyle(appDocument.body).backgroundColor === 'rgb(0, 0, 0)',
            'The scheduled screen is not fully black.');
        rect = blackoutButton.getBoundingClientRect();
        check(rect.left <= 1 && rect.top <= 1 && rect.right >= appWindow.innerWidth - 1 &&
            rect.bottom >= appWindow.innerHeight - 1,
            'The black screen control does not cover the full screen.');
        check(appDocument.elementFromPoint(appWindow.innerWidth / 2, appWindow.innerHeight / 2) === blackoutButton,
            'A tap in the middle of the black screen cannot reach Settings.');

        blackoutButton.focus();
        check(appDocument.activeElement === blackoutButton, 'The black screen control cannot receive keyboard focus.');
        inputEvent = appDocument.createEvent('Event');
        inputEvent.initEvent('keydown', true, true);
        appDocument.dispatchEvent(inputEvent);
        check(root.classList.contains('keyboard-input') &&
            appWindow.getComputedStyle(blackoutButton).outlineWidth === '2px',
            'Keyboard focus is not visible on the black screen control.');
        inputEvent = appDocument.createEvent('Event');
        inputEvent.initEvent('touchstart', true, true);
        appDocument.dispatchEvent(inputEvent);
        check(!root.classList.contains('keyboard-input'), 'Touch input did not restore the all-black surface.');
        blackoutButton.click();
        check(!settings.hidden && appWindow.getComputedStyle(settings).display !== 'none',
            'Activating the black screen did not show Settings.');
        check(painting.hidden, 'The painting is visible behind Settings.');

        cancel.click();
        check(root.classList.contains('night-display') && !blackoutButton.hidden,
            'Returning during scheduled night hours did not restore the black screen.');
        check(settings.hidden && painting.hidden, 'The app did not return from Settings to blackout.');
        check(appWindow.getComputedStyle(blackoutButton).outlineWidth === '0px',
            'Returning from Settings added a visible focus mark to the black screen.');
        check(requestCount === 0, 'Returning while the night schedule is active started an API request.');

        blackoutButton.click();
        check(!settings.hidden, 'The black screen did not open Settings for the night-end check.');
        expired = new Date(end.getTime() + 60000);
        updateClock(expired);
        cancel.click();

        function waitForPainting(attempt) {
            if (root.classList.contains('night-display')) {
                if (attempt >= 100) {
                    fail(new Error('Returning after night hours did not refresh the painting.'));
                    return;
                }
                window.setTimeout(function () { waitForPainting(attempt + 1); }, 20);
                return;
            }

            try {
                check(settings.hidden && !painting.hidden, 'The app did not return to the painting after night hours.');
                check(appDocument.getElementById('plate-title').textContent === 'Controlled Blackbird',
                    'The painting did not render the controlled API response.');
                check(requestCount === 1, 'The app did not make exactly one refresh request after night hours.');
                status.setAttribute('data-result', 'pass');
                setStatus('Passed: black-screen input opens Settings; return stays black during the schedule and refreshes the painting after it ends.');
            } catch (error) {
                fail(error);
            }
        }

        waitForPainting(0);
    }

    frame.addEventListener('load', function () {
        try {
            run();
        } catch (error) {
            fail(error);
        }
    });

    frame.src = '../index.html?source=station&station=1&view=latest&limit=12&night=1&nightStart=' +
        encodeURIComponent(time(start)) + '&nightEnd=' + encodeURIComponent(time(end));
}(window, document));
