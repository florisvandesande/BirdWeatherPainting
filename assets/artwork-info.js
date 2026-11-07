(function (window, document) {
    'use strict';

    var artwork = window.BirdWeatherArtwork;
    var text = window.BirdWeatherArtworkText;
    var speciesText = window.BirdWeatherText;
    var button = document.getElementById('artwork-button');
    var painting = document.getElementById('painting');
    var dialog = document.getElementById('artwork-info');
    var closeButton = document.getElementById('artwork-close');
    var dailyStatus = document.getElementById('daily-list-status');
    var dailyList = document.getElementById('daily-species-list');
    var list = document.getElementById('artwork-missing');
    var empty = document.getElementById('artwork-missing-empty');
    var select = document.getElementById('artwork-select');
    var copyHelp = document.getElementById('artwork-copy-help');
    var locale = 'en';
    var dailySpecies = [];
    var entries = [];
    var expandedSpeciesId = null;
    var dailyLoaded = false;
    var dailyLoading = false;
    var dailyError = false;
    var dailyLoader = null;
    var refreshDailyOnOpen = false;
    var loadGeneration = 0;

    function append(parent, tag, value) {
        var node = document.createElement(tag);
        node.textContent = value;
        parent.appendChild(node);
        return node;
    }

    function label(parent, key, value, href) {
        append(parent, 'dt', text.message(locale, key));
        var description = append(parent, 'dd', '');
        description.dir = 'auto';
        if (href) {
            var link = append(description, 'a', value);
            link.href = href;
            link.rel = 'noreferrer';
        } else {
            description.textContent = value;
        }
    }

    function addCreditFields(parent, credit) {
        var fields = append(parent, 'dl', '');
        if (credit.workSubject) {
            label(fields, 'workSubject', credit.workSubject);
        } else if (credit.title) {
            label(fields, 'work', credit.title + ' · ' + credit.work);
        }
        label(fields, credit.creatorLabelKey || 'artist', credit.creator, credit.creatorUrl);
        if (credit.collection) {
            label(fields, 'collection', credit.collection, credit.collectionUrl);
        }
        if (credit.sourceCollection) {
            label(fields, 'sourceCollection', credit.sourceCollection);
        }
        label(fields, 'source', text.message(locale, 'sourceLink'), credit.source);
        label(fields, 'license', credit.license, credit.licenseUrl);
    }

    function addSpeciesFields(parent, species) {
        var fields = append(parent, 'dl', '');
        var hasFields = false;
        if (typeof species.detectionCount === 'number' && isFinite(species.detectionCount)) {
            label(fields, 'detectedToday', speciesText.formatNumber(locale, species.detectionCount));
            hasFields = true;
        }
        if (species.wikipediaSummary) {
            label(fields, 'description', species.wikipediaSummary);
            hasFields = true;
        }
        if (species.wikipediaUrl) {
            label(fields, 'wikipedia', text.message(locale, 'wikipedia'), species.wikipediaUrl);
            hasFields = true;
        }
        if (species.ebirdUrl) {
            label(fields, 'ebird', text.message(locale, 'ebird'), species.ebirdUrl);
            hasFields = true;
        }
        if (!hasFields) {
            parent.removeChild(fields);
        }
    }

    function renderCreditDetails(entry) {
        entry.details.textContent = '';
        addSpeciesFields(entry.details, entry.species);
        if (entry.credit) {
            addCreditFields(entry.details, entry.credit);
        } else if (typeof entry.species.detectionCount !== 'number' &&
                !entry.species.wikipediaSummary && !entry.species.wikipediaUrl && !entry.species.ebirdUrl) {
            append(entry.details, 'p', text.message(locale, 'noArtworkInfo'));
        }
    }

    function updateEntry(entry) {
        var common = speciesText.speciesName(locale, entry.species);
        entry.commonName.textContent = common.name;
        entry.commonName.setAttribute('lang', common.language);
        entry.button.setAttribute('aria-expanded', expandedSpeciesId === entry.id ? 'true' : 'false');
        entry.details.hidden = expandedSpeciesId !== entry.id;
        if (expandedSpeciesId === entry.id) {
            renderCreditDetails(entry);
        }
    }

    function paintEntry(entry) {
        artwork.paint(entry.image, entry.species, function (credit) {
            entry.credit = credit;
            if (expandedSpeciesId === entry.id) {
                renderCreditDetails(entry);
            }
            if (!dialog.hidden) {
                renderMissing();
            }
        });
    }

    function renderSpecies() {
        dailyList.textContent = '';
        entries = [];
        if (expandedSpeciesId && !dailySpecies.some(function (species) {
            return species.id === expandedSpeciesId;
        })) {
            expandedSpeciesId = null;
        }

        dailySpecies.forEach(function (species) {
            var item = document.createElement('li');
            var row = document.createElement('button');
            var image = document.createElement('img');
            var names = document.createElement('span');
            var commonName = document.createElement('span');
            var scientificName = document.createElement('i');
            var details = document.createElement('div');
            var id = species.id;
            var entry = {
                id: id,
                species: species,
                image: image,
                commonName: commonName,
                scientificName: scientificName,
                button: row,
                details: details,
                credit: null
            };

            item.className = 'daily-species-item';
            row.type = 'button';
            row.className = 'daily-species-row';
            row.id = 'daily-species-row-' + id;
            row.setAttribute('aria-controls', 'daily-species-details-' + id);
            row.addEventListener('click', function () {
                expandedSpeciesId = expandedSpeciesId === id ? null : id;
                entries.forEach(updateEntry);
            });

            image.className = 'daily-species-art';
            image.src = 'assets/field-sprig.svg';
            image.alt = '';
            image.draggable = false;

            names.className = 'daily-species-names';
            names.dir = 'auto';
            commonName.className = 'daily-species-common';
            scientificName.className = 'daily-species-scientific';
            scientificName.textContent = species.scientificName;
            names.appendChild(commonName);
            names.appendChild(scientificName);
            row.appendChild(image);
            row.appendChild(names);

            details.id = 'daily-species-details-' + id;
            details.className = 'daily-species-details';
            details.setAttribute('role', 'region');
            details.setAttribute('aria-labelledby', row.id);
            item.appendChild(row);
            item.appendChild(details);
            dailyList.appendChild(item);
            entries.push(entry);
            updateEntry(entry);
            paintEntry(entry);
        });
        updateDailyStatus();
    }

    function setDailySpecies(species) {
        var next = Array.isArray(species) ? species : [];
        var sameSpecies = next.length === entries.length && next.every(function (bird, index) {
            return bird.id === entries[index].id;
        });
        dailyLoaded = true;
        dailySpecies = next;
        if (!sameSpecies) {
            renderSpecies();
            return;
        }
        next.forEach(function (bird, index) {
            var entry = entries[index];
            var imageChanged = entry.species.scientificName !== bird.scientificName;
            entry.species = bird;
            entry.scientificName.textContent = bird.scientificName;
            updateEntry(entry);
            if (imageChanged) {
                entry.credit = null;
                paintEntry(entry);
            }
        });
        updateDailyStatus();
    }

    function renderMissing() {
        var rows = artwork.missingSpecies().map(function (entry) {
            return entry.commonName + ' — ' + entry.scientificName + ' (' + entry.id + ')';
        });
        var missingText = rows.join('\n');
        if (list.value !== missingText) {
            list.value = missingText;
        }
        empty.hidden = !!rows.length;
        list.hidden = select.hidden = copyHelp.hidden = !rows.length;
    }

    function updateDailyStatus() {
        var message = '';
        if (dailyLoading) {
            message = text.message(locale, 'dailyLoading');
        } else if (dailyError) {
            message = text.message(locale, 'dailyUnavailable');
        } else if (dailyLoaded && !dailySpecies.length) {
            message = text.message(locale, 'noSpeciesToday');
        }
        dailyStatus.textContent = message;
    }

    function loadTodaySpecies() {
        if (!dailyLoader || dailyLoading) {
            return;
        }
        loadGeneration += 1;
        var generation = loadGeneration;
        dailyLoading = true;
        dailyError = false;
        updateDailyStatus();
        dailyLoader(function (error, result) {
            if (generation !== loadGeneration) {
                return;
            }
            dailyLoading = false;
            if (error) {
                dailyError = true;
                updateDailyStatus();
                return;
            }
            dailyError = false;
            setDailySpecies(result && result.dailySpecies);
        });
    }

    function setLocale(value) {
        locale = value;
        var labels = document.querySelectorAll('[data-artwork-text]');
        for (var index = 0; index < labels.length; index += 1) {
            var item = labels[index];
            item.textContent = text.message(locale, item.getAttribute('data-artwork-text'));
        }
        button.setAttribute('aria-label', text.message(locale, 'title'));
        entries.forEach(updateEntry);
        updateDailyStatus();
        if (!dialog.hidden) {
            renderMissing();
        }
    }

    function setDailyLoader(loader, refreshOnOpen) {
        dailyLoader = typeof loader === 'function' ? loader : null;
        refreshDailyOnOpen = Boolean(refreshOnOpen);
    }

    function open() {
        renderMissing();
        button.setAttribute('aria-expanded', 'true');
        painting.classList.add('artwork-open');
        dialog.hidden = false;
        dialog.scrollTop = 0;
        closeButton.focus();
        updateDailyStatus();
        if (dailyLoader && (refreshDailyOnOpen || !dailyLoaded)) {
            loadTodaySpecies();
        }
    }

    function close() {
        if (dialog.hidden) {
            return;
        }
        dialog.hidden = true;
        painting.classList.remove('artwork-open');
        button.setAttribute('aria-expanded', 'false');
        button.focus();
    }

    button.addEventListener('click', open);
    closeButton.addEventListener('click', close);
    select.addEventListener('click', function () {
        list.focus();
        list.select();
        list.setSelectionRange(0, list.value.length);
    });
    dialog.addEventListener('keydown', function (event) {
        if (event.keyCode === 27) {
            event.preventDefault();
            close();
        }
        if (event.keyCode === 9) {
            var controls = dialog.querySelectorAll('button:not([hidden]), a[href], textarea:not([hidden])');
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
        setDailyLoader: setDailyLoader,
        setDailySpecies: setDailySpecies,
        close: close
    };
}(window, document));
