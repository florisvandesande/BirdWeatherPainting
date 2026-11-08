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

    function loadSpecies() {
        requestGeneration += 1;
        var generation = requestGeneration;
        if (currentRequest && typeof currentRequest.abort === 'function') {
            currentRequest.abort();
        }
        species = [];
        expandedId = null;
        list.textContent = '';
        showStatus('loadingSpecies', false);
        if (!speciesLoader) {
            showStatus('speciesUnavailable', true);
            return;
        }
        currentRequest = speciesLoader(function (error, result) {
            if (generation !== requestGeneration || dialog.hidden) {
                return;
            }
            currentRequest = null;
            if (error || !result || !Array.isArray(result.allSpecies || result.species)) {
                showStatus('speciesUnavailable', true);
                return;
            }
            species = result.allSpecies || result.species;
            showStatus(species.length ? '' : 'noSpeciesToday', false);
            renderSpecies();
        }, locale);
    }

    function setLocale(value) {
        locale = value;
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
        speciesLoader = typeof loader === 'function' ? loader : null;
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
        requestGeneration += 1;
        if (currentRequest && typeof currentRequest.abort === 'function') {
            currentRequest.abort();
        }
        currentRequest = null;
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
        close: close
    };
}(window, document));
