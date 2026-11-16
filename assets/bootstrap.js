(function (window, document) {
    'use strict';

    var preferences = window.BirdWeatherPreferences;
    var config = preferences.read();
    var display = preferences.readDisplay();
    var collageFiles = [
        'assets/collage-zone-data.js',
        'assets/collage-day.js',
        'assets/collage-data.js',
        'assets/collage-layout.js',
        'assets/collage-view.js?v=hidden-board-guard-1'
    ];
    var infoFiles = collageFiles.slice(0, 3);
    var infoFilesLoaded = false;
    var infoFilesLoading = false;
    var infoFileWaiters = [];

    // Serial loading keeps these dependent scripts ordered on older mobile Safari.
    function appendScript(path, complete) {
        var script = document.createElement('script');
        script.src = path;
        script.onload = function () { complete(null); };
        script.onerror = function () { complete('unavailable'); };
        (document.head || document.getElementsByTagName('head')[0] || document.body).appendChild(script);
    }

    // This parser-blocking bootstrap inserts initial scripts before document parsing ends.
    function writeScripts(paths) {
        paths.forEach(function (path) {
            document.write('<script src="' + path + '"><' + '/script>');
        });
    }

    function loadInfoModules(complete) {
        if (infoFilesLoaded) {
            complete(null);
            return;
        }
        infoFileWaiters.push(complete);
        if (infoFilesLoading) {
            return;
        }
        infoFilesLoading = true;
        var index = 0;
        function loadNext() {
            if (index >= infoFiles.length) {
                infoFilesLoading = false;
                infoFilesLoaded = true;
                var waiters = infoFileWaiters;
                infoFileWaiters = [];
                waiters.forEach(function (waiter) { waiter(null); });
                return;
            }
            var path = infoFiles[index];
            index += 1;
            // Load dependent data scripts one at a time instead of relying on async=false.
            appendScript(path, function (error) {
                if (error) {
                    infoFilesLoading = false;
                    var waiters = infoFileWaiters;
                    infoFileWaiters = [];
                    waiters.forEach(function (waiter) { waiter(error); });
                } else {
                    loadNext();
                }
            });
        }
        loadNext();
    }

    window.BirdWeatherBootstrap = { loadInfoModules: loadInfoModules };

    if (config && display.view === 'today') {
        infoFilesLoaded = true;
        writeScripts(collageFiles);
    }
    writeScripts(['assets/painting.js']);
}(window, document));
