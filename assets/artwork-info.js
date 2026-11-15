(function (window, document) {
    'use strict';

    var text = window.BirdWeatherArtworkText;
    var birdText = window.BirdWeatherText;
    var button = document.getElementById('artwork-button');
    var dialog = document.getElementById('artwork-info');
    var closeButton = document.getElementById('artwork-close');
    var list = document.getElementById('artwork-birds');
    var status = document.getElementById('artwork-status');
    var retryButton = document.getElementById('artwork-retry');
    var locale = 'en';
    var species = [];
    var speciesLoader = null;
    var expandedId = null;
    var requestGeneration = 0;
    var currentRequest = null;
    var currentRequestLocale = '';
    var currentRequestBackground = false;
    var cachedSpecies = null;
    var cachedLocale = '';
    var cachedAt = 0;
    var cacheLifetime = 120000;

    function message(key, fields) {
        return text.message(locale, key, fields);
    }

    function append(parent, tag, className, value) {
        var node = document.createElement(tag);
        if (className) {
            node.className = className;
        }
        if (value !== undefined) {
            node.textContent = value;
        }
        parent.appendChild(node);
        return node;
    }

    function safeUrl(value, service) {
        if (typeof value !== 'string' || value.length > 2048 || !/^https:\/\//i.test(value)) {
            return '';
        }
        var anchor = document.createElement('a');
        anchor.href = value;
        var host = anchor.hostname.toLowerCase();
        if (service === 'ebird') {
            return host === 'ebird.org' || /\.ebird\.org$/.test(host) ? value : '';
        }
        return host === 'wikipedia.org' || /\.wikipedia\.org$/.test(host) ? value : '';
    }

    function descriptionFor(bird) {
        return typeof bird.wikipediaSummary === 'string' ? bird.wikipediaSummary.trim() : '';
    }

    function makeLink(container, bird, service, url) {
        if (!url) {
            return;
        }
        var link = append(container, 'a', '', service === 'ebird' ? 'eBird' : 'Wikipedia');
        var common = birdText.speciesName(locale, bird).name;
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.setAttribute('aria-label', message(
            service === 'ebird' ? 'ebirdLinkLabel' : 'wikipediaLinkLabel', { name: common }));
    }

    function makeRow(bird, index) {
        var item = append(list, 'li', 'artwork-bird');
        var row = append(item, 'div', 'artwork-bird-row');
        var toggle = append(row, 'button', 'artwork-bird-toggle');
        var image = append(toggle, 'img', 'artwork-bird-image');
        image.alt = '';
        image.draggable = false;

        var names = append(toggle, 'span', 'artwork-bird-names');
        var common = birdText.speciesName(locale, bird);
        var commonName = append(names, 'span', 'artwork-bird-common', common.name);
        commonName.setAttribute('lang', common.language);
        commonName.dir = 'auto';
        var latin = append(names, 'i', 'artwork-bird-scientific', bird.scientificName);
        latin.dir = 'auto';

        var links = append(row, 'div', 'artwork-bird-links');
        var wikipediaUrl = safeUrl(bird.wikipediaUrl, 'wikipedia');
        var ebirdUrl = safeUrl(bird.ebirdUrl, 'ebird');
        makeLink(links, bird, 'wikipedia', wikipediaUrl);
        makeLink(links, bird, 'ebird', ebirdUrl);

        var id = 'artwork-description-' + index;
        var description = append(item, 'p', 'artwork-bird-description',
            descriptionFor(bird) || message('noDescription'));
        description.id = id;
        description.hidden = true;
        description.dir = 'auto';

        toggle.type = 'button';
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-controls', id);
        toggle.addEventListener('click', function () {
            var isOpen = toggle.getAttribute('aria-expanded') === 'true';
            closeExpandedRow();
            if (!isOpen) {
                expandedId = bird.id;
                toggle.setAttribute('aria-expanded', 'true');
                description.hidden = false;
            }
        });

        window.BirdWeatherArtwork.paintCollage(image, bird, function (credit, ready) {
            if (ready && !credit) {
                image.hidden = true;
            }
        });
    }

    function closeExpandedRow() {
        if (!expandedId) {
            return;
        }
        var rows = list.querySelectorAll('.artwork-bird');
        for (var index = 0; index < rows.length; index += 1) {
            var toggle = rows[index].querySelector('.artwork-bird-toggle');
            if (toggle.getAttribute('aria-expanded') === 'true') {
                toggle.setAttribute('aria-expanded', 'false');
                rows[index].querySelector('.artwork-bird-description').hidden = true;
            }
        }
        expandedId = null;
    }

    function renderSpecies() {
        list.textContent = '';
        species.forEach(makeRow);
        closeExpandedRow();
    }

    function showStatus(key, retry) {
        status.textContent = key ? message(key) : '';
        status.hidden = !key;
        retryButton.hidden = !retry;
    }

    function clearCache() {
        cachedSpecies = null;
        cachedLocale = '';
        cachedAt = 0;
    }

    function cancelCurrentRequest() {
        requestGeneration += 1;
        if (currentRequest && typeof currentRequest.abort === 'function') {
            currentRequest.abort();
        }
        currentRequest = null;
        currentRequestLocale = '';
        currentRequestBackground = false;
    }

    function startSpeciesLoad(background) {
        var requestedLocale = locale;
        if (!speciesLoader) {
            if (!background) {
                showStatus('speciesUnavailable', true);
            }
            return;
        }
        if (currentRequestLocale === requestedLocale) {
            if (!background && cachedSpecies === null) {
                showStatus('loadingSpecies', false);
            }
            return;
        }

        cancelCurrentRequest();
        var generation = requestGeneration;
        currentRequestLocale = requestedLocale;
        currentRequestBackground = background;
        if (!background) {
            species = [];
            expandedId = null;
            list.textContent = '';
            showStatus('loadingSpecies', false);
        }

        function finish(error, result) {
            if (generation !== requestGeneration) {
                return;
            }
            currentRequest = null;
            currentRequestLocale = '';
            currentRequestBackground = false;
            var birds = result && (result.allSpecies || result.species);
            if (error || !Array.isArray(birds)) {
                if (!dialog.hidden && locale === requestedLocale &&
                        !(cachedLocale === requestedLocale && cachedSpecies !== null)) {
                    showStatus('speciesUnavailable', true);
                }
                return;
            }
            cachedSpecies = birds;
            cachedLocale = requestedLocale;
            cachedAt = Date.now();
            if (!dialog.hidden && locale === requestedLocale) {
                species = birds;
                showStatus(species.length ? '' : 'noSpeciesToday', false);
                renderSpecies();
            }
        }

        try {
            var request = speciesLoader(finish, requestedLocale);
            if (generation === requestGeneration && currentRequestLocale === requestedLocale) {
                currentRequest = request;
            }
        } catch (error) {
            finish('unavailable');
        }
    }

    function loadSpecies() {
        if (cachedLocale === locale && cachedSpecies !== null) {
            species = cachedSpecies;
            showStatus(species.length ? '' : 'noSpeciesToday', false);
            renderSpecies();
            if (Date.now() - cachedAt >= cacheLifetime) {
                startSpeciesLoad(true);
            }
            return;
        }

        species = [];
        expandedId = null;
        list.textContent = '';
        showStatus('loadingSpecies', false);
        startSpeciesLoad(false);
    }

    function prefetch() {
        if (cachedLocale === locale && cachedSpecies !== null && Date.now() - cachedAt < cacheLifetime) {
            return;
        }
        startSpeciesLoad(true);
    }

    function setLocale(value) {
        if (locale !== value) {
            locale = value;
            clearCache();
            if (currentRequestLocale && currentRequestLocale !== locale) {
                cancelCurrentRequest();
            }
        }
        var translated = dialog.querySelectorAll('[data-artwork-text]');
        for (var index = 0; index < translated.length; index += 1) {
            translated[index].textContent = message(translated[index].getAttribute('data-artwork-text'));
        }
        button.setAttribute('aria-label', message('openInfo'));
        retryButton.textContent = message('retry');
        if (!dialog.hidden) {
            loadSpecies();
        }
    }

    function setSpeciesLoader(loader) {
        var nextLoader = typeof loader === 'function' ? loader : null;
        if (nextLoader !== speciesLoader) {
            cancelCurrentRequest();
            clearCache();
        }
        speciesLoader = nextLoader;
    }

    function open() {
        button.setAttribute('aria-expanded', 'true');
        document.getElementById('painting').classList.add('artwork-open');
        dialog.hidden = false;
        dialog.scrollTop = 0;
        closeButton.focus();
        loadSpecies();
    }

    function close() {
        if (dialog.hidden) {
            return;
        }
        if (currentRequestLocale && !currentRequestBackground) {
            cancelCurrentRequest();
        }
        dialog.hidden = true;
        document.getElementById('painting').classList.remove('artwork-open');
        button.setAttribute('aria-expanded', 'false');
        button.focus();
    }

    button.addEventListener('click', open);
    closeButton.addEventListener('click', close);
    retryButton.addEventListener('click', loadSpecies);
    dialog.addEventListener('keydown', function (event) {
        if (event.keyCode === 27) {
            event.preventDefault();
            close();
        }
        if (event.keyCode === 9) {
            var controls = dialog.querySelectorAll('button:not([hidden]), a[href]');
            var last = controls[controls.length - 1];
            if (event.shiftKey && document.activeElement === closeButton) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                closeButton.focus();
            }
        }
    });

    document.addEventListener('birdweather-language', function () {
        if (window.BirdWeatherPreferences) {
            setLocale(window.BirdWeatherPreferences.locale());
        }
    });

    window.BirdWeatherArtworkInfo = {
        setLocale: setLocale,
        setSpeciesLoader: setSpeciesLoader,
        prefetch: prefetch,
        close: close
    };
}(window, document));
