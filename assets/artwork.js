(function (window, document) {
    'use strict';

    var storagePrefix = 'birdweather-missing-artwork:';
    var sprig = 'assets/field-sprig.svg';
    var missingInSession = Object.create(null);
    var storageUnavailable = false;
    var catalogPath = 'assets/artwork/catalog.json?v=3';
    var catalogState = 'idle';
    var catalog = null;
    var catalogWaiters = [];
    var selectedBirdImages = Object.create(null);
    var failedImages = Object.create(null);
    var perchOrder = null;
    var selectedPerchPath = null;
    var fallbackPerches = [
        'assets/artwork/perches/birch-twig.jpg',
        'assets/artwork/perches/blackthorn-branch.jpg',
        'assets/artwork/perches/cherry-branch.jpg',
        'assets/artwork/perches/hawthorn-branch.jpg',
        'assets/artwork/perches/jack-pine-bough.jpg',
        'assets/artwork/perches/juniper-sprig.jpg',
        'assets/artwork/perches/oak-shoot.jpg',
        'assets/artwork/perches/pine-bough.jpg',
        'assets/artwork/perches/spruce-bough.jpg'
    ];
    var appearanceQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    var commons = 'https://commons.wikimedia.org/wiki/File:Nederlandsche_vogelen_(KB)_-_';
    var publicDomain = 'https://creativecommons.org/publicdomain/mark/1.0/';
    var fuglerammeLicense = 'CC BY-SA 4.0';
    var fuglerammeLicenseUrl = 'https://creativecommons.org/licenses/by-sa/4.0/';
    var fuglerammeAttribution = 'https://github.com/arnegiacomo/fugleramme/blob/main/assets/artwork/classic/ATTRIBUTION.md';
    var fuglerammeCreator = 'https://github.com/arnegiacomo/fugleramme';

    function historicalPlate(species, file, title, work, source) {
        return {
            species: species,
            image: 'assets/artwork/' + file + '.jpg',
            creator: 'Christiaan Andreas Sepp & Jan Christiaan Sepp',
            title: title,
            work: work,
            source: commons + source + '.jpg',
            collection: 'KB, nationale bibliotheek, KW 1047 B 10–14',
            license: 'Public Domain Mark 1.0',
            licenseUrl: publicDomain,
            edits: 'historicalEdits'
        };
    }

    var plates = {
        'Erithacus rubecula': historicalPlate('Erithacus rubecula', 'erithacus-rubecula',
            'Roodborst', 'Nederlandsche vogelen, I · 48', 'Erithacus_rubecula_(086b)'),
        'Turdus merula': historicalPlate('Turdus merula', 'turdus-merula',
            'Merel', 'Nederlandsche vogelen, I · 10', 'Turdus_merula_(016f)'),
        'Parus major': historicalPlate('Parus major', 'parus-major',
            'Koolmees', 'Nederlandsche vogelen, II · 60', 'Parus_major_(112b)'),
        'Cyanistes caeruleus': historicalPlate('Cyanistes caeruleus', 'cyanistes-caeruleus',
            'Pimpelmees', 'Nederlandsche vogelen, I · 24', 'Cyanistes_caeruleus_(044b)')
    };

    function readCreator(value) {
        // BirdWeather supplies either a name or one credit anchor. Read only its text and href.
        if (typeof value !== 'string' || value.length > 1024 || !value.trim()) {
            return null;
        }
        var match = /^<a\s+([^<>]+)>([^<>]+)<\/a>$/i.exec(value.trim());
        if (!match) {
            return /^[^<>]{1,160}$/.test(value.trim()) ? { name: value.trim() } : null;
        }

        var attributes = match[1];
        var href = '';
        while (attributes) {
            var attribute = /^\s*([a-z]+)\s*=\s*(?:"([^"]*)"|'([^']*)')\s*/i.exec(attributes);
            if (!attribute || !/^(href|title|class|rel)$/i.test(attribute[1])) {
                return null;
            }
            if (attribute[1].toLowerCase() === 'href') {
                if (href) {
                    return null;
                }
                href = attribute[2] || attribute[3] || '';
            }
            attributes = attributes.slice(attribute[0].length);
        }
        if (/^\/\//.test(href)) {
            href = 'https:' + href;
        }
        if (!/^https?:\/\/[a-z0-9.-]+(?::\d{1,5})?(?:[/?#][^\s<>"'\\]*)?$/i.test(href) ||
                !match[2].trim() || match[2].length > 160) {
            return null;
        }
        // The parser sees only the bounded, tag-free anchor text.
        var creator = new window.DOMParser().parseFromString(match[2], 'text/html').body.textContent.trim();
        return creator ? { name: creator, url: href } : null;
    }

    function approvedLicenseUrl(license) {
        var cc = typeof license === 'string' && /^CC BY(-SA)? (2\.0|2\.5|3\.0|4\.0)$/.exec(license);
        if (cc) {
            return 'https://creativecommons.org/licenses/' + (cc[1] ? 'by-sa/' : 'by/') + cc[2] + '/';
        }
        if (license === 'CC0 1.0') {
            return 'https://creativecommons.org/publicdomain/zero/1.0/';
        }
        return license === 'Public Domain Mark 1.0' ? publicDomain : '';
    }

    function remotePlate(species) {
        var image = species.imageUrl;
        // Only the expected raster paths on the BirdWeather media host are requested.
        var path = typeof image === 'string' && image.length <= 512 &&
            /^https:\/\/media\.birdweather\.com\/species\/([1-9][0-9]{0,17})\/[a-zA-Z0-9_.-]+\.(?:jpg|jpeg|png)$/.exec(image);
        if (!path || path[1] !== String(species.id)) {
            return null;
        }
        var license = species.imageLicense;
        var licenseUrl = approvedLicenseUrl(license);
        if (!licenseUrl || (species.imageLicenseUrl !== licenseUrl && species.imageLicenseUrl !== licenseUrl.slice(0, -1))) {
            return null;
        }
        var creator = readCreator(species.imageCredit);
        if (!creator) {
            return null;
        }
        return {
            species: species.scientificName,
            image: image,
            creator: creator.name,
            creatorUrl: creator.url,
            source: image,
            license: license,
            licenseUrl: licenseUrl,
            edits: 'remoteEdits'
        };
    }

    function speciesRecord(species) {
        if (!species || typeof species.id !== 'string' || !/^[1-9][0-9]{0,17}$/.test(species.id) ||
                typeof species.commonName !== 'string' || species.commonName.length > 160 ||
                typeof species.scientificName !== 'string' || species.scientificName.length > 160) {
            return null;
        }
        var commonName = species.commonName.replace(/[\x00-\x1f\x7f]/g, ' ').trim();
        var scientificName = species.scientificName.replace(/[\x00-\x1f\x7f]/g, ' ').trim();
        return commonName && scientificName ? { id: species.id, commonName: commonName, scientificName: scientificName } : null;
    }

    function normalizeName(value) {
        return typeof value === 'string' ? value.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase() : '';
    }

    function safeSourceUrl(value) {
        return typeof value === 'string' && value.length <= 800 &&
            /^https:\/\/[a-z0-9.-]+(?::[0-9]{1,5})?(?:[\/?#][^\s<>"\\]*)?$/i.test(value);
    }

    function validCatalog(value) {
        return value && value.license === fuglerammeLicense && value.licenseUrl === fuglerammeLicenseUrl &&
            value.attributionUrl === fuglerammeAttribution && value.creator === 'Fugleramme contributors' &&
            value.creatorUrl === fuglerammeCreator && value.paperColor === '#f0ece6' &&
            value.darkPaperColor === '#171512' &&
            Object.prototype.toString.call(value.birds) === '[object Object]' &&
            Object.prototype.toString.call(value.aliases) === '[object Object]' &&
            Object.prototype.toString.call(value.perches) === '[object Array]';
    }

    function prepareCatalog(value) {
        if (!validCatalog(value)) {
            return null;
        }
        var aliases = Object.create(null);
        Object.keys(value.aliases).forEach(function (alias) {
            if (typeof value.aliases[alias] === 'string' && alias.length <= 160) {
                aliases[normalizeName(alias)] = normalizeName(value.aliases[alias]);
            }
        });
        value.aliases = aliases;
        return value;
    }

    function loadCatalog(complete) {
        if (catalogState === 'ready' || catalogState === 'failed') {
            complete(catalog);
            return;
        }
        catalogWaiters.push(complete);
        if (catalogState === 'loading') {
            return;
        }

        catalogState = 'loading';
        var request;
        var completed = false;

        function finish(value) {
            if (completed) {
                return;
            }
            completed = true;
            catalog = prepareCatalog(value);
            catalogState = catalog ? 'ready' : 'failed';
            var waiters = catalogWaiters;
            catalogWaiters = [];
            waiters.forEach(function (waiter) {
                waiter(catalog);
            });
        }

        try {
            request = new XMLHttpRequest();
            request.timeout = 12000;
            request.open('GET', catalogPath, true);
            request.onreadystatechange = function () {
                if (request.readyState !== 4) {
                    return;
                }
                var response = null;
                try {
                    response = request.status >= 200 && request.status < 300 && request.responseText.length <= 2000000 ?
                        JSON.parse(request.responseText) : null;
                } catch (error) {
                    response = null;
                }
                finish(response);
            };
            request.onerror = request.ontimeout = function () { finish(null); };
            request.send(null);
        } catch (error) {
            finish(null);
        }
    }

    function safeWorkSubject(value) {
        return typeof value === 'string' && value.length <= 400 ?
            value.replace(/[\x00-\x1f\x7f]/g, ' ').replace(/\s+/g, ' ').trim() : '';
    }

    function safeImageRecord(record, source, kind, workSubject) {
        var allowedPath = kind === 'perch' ? /^perches\/[a-z0-9_-]+\.jpg$/ : /^birds\/[a-z0-9_-]+\.jpg$/;
        var allowedDarkPath = kind === 'perch' ? /^perches\/[a-z0-9_-]+-dark\.jpg$/ : /^birds\/[a-z0-9_-]+-dark\.jpg$/;
        if (!record || typeof record.path !== 'string' || !allowedPath.test(record.path) ||
                typeof record.darkPath !== 'string' || !allowedDarkPath.test(record.darkPath) ||
                typeof record.source !== 'string' || record.source.length > 80 || !safeSourceUrl(record.sourceUrl)) {
            return null;
        }
        var subject = safeWorkSubject(workSubject);
        return {
            kind: kind,
            image: 'assets/artwork/' + record.path,
            darkImage: 'assets/artwork/' + record.darkPath,
            workSubject: subject,
            creatorLabelKey: 'collectionPreparer',
            creator: source.creator,
            creatorUrl: source.creatorUrl,
            source: record.sourceUrl,
            collection: 'Fugleramme Classic',
            collectionUrl: source.attributionUrl,
            sourceCollection: record.source,
            license: source.license,
            licenseUrl: source.licenseUrl,
            edits: 'fuglerammeEdits'
        };
    }

    function birdImages(species, source) {
        var name = normalizeName(species.scientificName);
        var names = [name];
        var words = name.split(' ');
        if (words.length > 2) {
            names.push(words.slice(0, 2).join(' '));
        }
        var keys = [];
        names.forEach(function (candidate) {
            var canonical = source.aliases[candidate];
            var key = canonical ? normalizeName(canonical) : candidate;
            if (source.birds[key] && keys.indexOf(key) === -1) {
                keys.push(key);
            }
            if (!source.birds[key] && source.birds[candidate] && keys.indexOf(candidate) === -1) {
                keys.push(candidate);
            }
        });

        if (!keys.length) {
            Object.keys(source.aliases).some(function (alias) {
                var canonical = normalizeName(source.aliases[alias]);
                if (names.indexOf(canonical) !== -1 && source.birds[normalizeName(alias)]) {
                    keys.push(normalizeName(alias));
                    return true;
                }
                return false;
            });
        }

        var records = [];
        keys.forEach(function (key) {
            var entry = source.birds[key];
            if (entry && Object.prototype.toString.call(entry.images) === '[object Array]') {
                entry.images.forEach(function (record) {
                    var subject = typeof entry.commonName === 'string' &&
                        typeof entry.scientificName === 'string' ?
                        entry.commonName + ' (' + entry.scientificName + ')' : species.scientificName;
                    var credit = safeImageRecord(record, source, 'bird', subject);
                    if (credit && !failedImages[credit.image] && !records.some(function (item) {
                        return item.image === credit.image;
                    })) {
                        credit.species = species.scientificName;
                        records.push(credit);
                    }
                });
            }
        });

        var selected = selectedBirdImages[name];
        if (selected) {
            records.sort(function (first, second) {
                return first.image === selected ? -1 : second.image === selected ? 1 : 0;
            });
        } else if (records.length > 1) {
            var selectedIndex = Math.floor(Math.random() * records.length);
            var selectedRecord = records.splice(selectedIndex, 1)[0];
            records.unshift(selectedRecord);
            selectedBirdImages[name] = selectedRecord.image;
        } else if (records.length) {
            selectedBirdImages[name] = records[0].image;
        }
        return records;
    }

    function shufflePerches(records) {
        for (var index = records.length - 1; index > 0; index -= 1) {
            var swap = Math.floor(Math.random() * (index + 1));
            var item = records[index];
            records[index] = records[swap];
            records[swap] = item;
        }
    }

    function perchCredits(source) {
        if (!perchOrder) {
            perchOrder = source.perches.slice(0);
            shufflePerches(perchOrder);
        }
        var records = [];
        perchOrder.forEach(function (record) {
            var subject = typeof record.name === 'string' ?
                record.name.replace(/[-_]+/g, ' ').replace(/^./, function (letter) { return letter.toUpperCase(); }) : '';
            var credit = safeImageRecord(record, source, 'perch', subject);
            if (credit && !failedImages[credit.image]) {
                credit.speciesTextKey = 'perch';
                records.push(credit);
            }
        });
        if (selectedPerchPath) {
            records.sort(function (first, second) {
                return first.image === selectedPerchPath ? -1 : second.image === selectedPerchPath ? 1 : 0;
            });
        }
        return records;
    }

    function fallbackPerchPath() {
        if (!selectedPerchPath || fallbackPerches.indexOf(selectedPerchPath) === -1) {
            selectedPerchPath = fallbackPerches[Math.floor(Math.random() * fallbackPerches.length)];
        }
        return selectedPerchPath;
    }

    function readMissing() {
        if (storageUnavailable) {
            return missingInSession;
        }
        try {
            var storage = window.localStorage;
            var records = Object.create(null);
            for (var index = 0; index < storage.length; index += 1) {
                var key = storage.key(index);
                if (key && key.indexOf(storagePrefix) === 0) {
                    var entry = readMissingEntry(storage.getItem(key));
                    if (entry && key === storagePrefix + entry.id) {
                        records[entry.id] = entry;
                    }
                }
            }
            missingInSession = records;
        } catch (error) {
            storageUnavailable = true;
        }
        return missingInSession;
    }

    function readMissingEntry(value) {
        try {
            return speciesRecord(JSON.parse(value));
        } catch (error) {
            // A damaged entry is ignored so the other species remain copyable.
            return null;
        }
    }

    function entries(records) {
        return Object.keys(records).map(function (id) {
            return records[id];
        });
    }

    function setMissing(species, missing) {
        var entry = speciesRecord(species);
        if (!entry) {
            return;
        }
        if (missing) {
            missingInSession[entry.id] = entry;
        } else {
            delete missingInSession[entry.id];
        }
        if (storageUnavailable) {
            return;
        }
        // One key per species avoids replacing entries recorded in another tab.
        try {
            var storage = window.localStorage;
            var key = storagePrefix + entry.id;
            if (missing) {
                var value = JSON.stringify(entry);
                if (storage.getItem(key) !== value) {
                    storage.setItem(key, value);
                }
            } else {
                storage.removeItem(key);
            }
        } catch (error) {
            // Keep unsaved changes available for the rest of this page session.
            storageUnavailable = true;
        }
    }

    function paint(image, species, onCreditChange) {
        image._birdweatherPaintRequest = (image._birdweatherPaintRequest || 0) + 1;
        var requestId = image._birdweatherPaintRequest;
        image._birdweatherPaintSpecies = species;
        image._birdweatherPaintCallback = onCreditChange;
        image.onload = image.onerror = null;
        image.setAttribute('referrerpolicy', 'no-referrer');
        image.classList.add('artwork-loading');
        onCreditChange(null);

        loadCatalog(function (source) {
            if (image._birdweatherPaintRequest !== requestId) {
                return;
            }
            var candidates = species ? birdImages(species, source || { birds: {}, aliases: {} }) :
                source ? perchCredits(source) : [];
            if (species) {
                var historical = Object.prototype.hasOwnProperty.call(plates, species.scientificName) && plates[species.scientificName];
                if (historical) {
                    candidates.push(historical);
                }
                var remote = remotePlate(species);
                if (remote) {
                    candidates.push(remote);
                }
            }
            var candidateIndex = 0;

            function showNext() {
                if (image._birdweatherPaintRequest !== requestId) {
                    return;
                }
                var credit = candidates[candidateIndex];
                candidateIndex += 1;
                if (!credit) {
                    image.onload = image.onerror = null;
                    image.classList.remove('artwork-loading');
                    var fallbackPath = species ? sprig : fallbackPerchPath();
                    if (!species && appearanceQuery && appearanceQuery.matches) {
                        fallbackPath = fallbackPath.replace(/\.jpg$/, '-dark.jpg');
                    }
                    image.setAttribute('src', fallbackPath);
                    if (species) {
                        setMissing(species, true);
                    }
                    onCreditChange(null);
                    return;
                }
                var imagePath = appearanceQuery && appearanceQuery.matches && credit.darkImage ?
                    credit.darkImage : credit.image;
                if (image.getAttribute('src') === imagePath && image.complete && image.naturalWidth) {
                    image.classList.remove('artwork-loading');
                    if (species) {
                        setMissing(species, false);
                    }
                    if (credit.kind === 'perch') {
                        selectedPerchPath = credit.image;
                    }
                    onCreditChange(credit);
                    return;
                }
                image.onload = function () {
                    image.onload = image.onerror = null;
                    if (image._birdweatherPaintRequest !== requestId) {
                        return;
                    }
                    image.classList.remove('artwork-loading');
                    if (species) {
                        setMissing(species, false);
                    }
                    if (credit.kind === 'perch') {
                        selectedPerchPath = credit.image;
                    }
                    onCreditChange(credit);
                };
                image.onerror = function () {
                    image.onload = image.onerror = null;
                    failedImages[credit.image] = true;
                    showNext();
                };
                image.setAttribute('src', imagePath);
            }

            showNext();
        });
    }

    function repaintForAppearance() {
        var images = document.querySelectorAll('.plate-art, .collage-specimen img, .daily-species-art');
        for (var index = 0; index < images.length; index += 1) {
            var image = images[index];
            if (typeof image._birdweatherPaintCallback === 'function') {
                paint(image, image._birdweatherPaintSpecies, image._birdweatherPaintCallback);
            }
        }
    }

    if (appearanceQuery && appearanceQuery.addEventListener) {
        appearanceQuery.addEventListener('change', repaintForAppearance);
    } else if (appearanceQuery && appearanceQuery.addListener) {
        appearanceQuery.addListener(repaintForAppearance);
    }

    readMissing();

    window.BirdWeatherArtwork = {
        paint: paint,
        resetPerch: function () {
            selectedPerchPath = null;
            if (perchOrder) {
                shufflePerches(perchOrder);
            }
        },
        localCredits: function () {
            return entries(plates);
        },
        missingSpecies: function () {
            return entries(readMissing());
        }
    };
}(window, document));
