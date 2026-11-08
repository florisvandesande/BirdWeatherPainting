(function (window) {
    'use strict';

    var sprig = 'assets/field-sprig.svg';
    var catalogPath = 'assets/artwork/catalog.json';
    var collageCatalogPath = 'assets/artwork/catalog.json';
    var catalogState = 'idle';
    var catalog = null;
    var catalogWaiters = [];
    var collageCatalogState = 'idle';
    var collageCatalog = null;
    var collageCatalogWaiters = [];
    var selectedBirdImages = Object.create(null);
    var failedImages = Object.create(null);
    var selectedSpeciesPerches = Object.create(null);
    var perchOrder = null;
    var selectedPerchPath = null;
    var fuglerammeLicense = 'CC BY-SA 4.0';
    var fuglerammeLicenseUrl = 'https://creativecommons.org/licenses/by-sa/4.0/';
    var fuglerammeAttribution = 'https://github.com/arnegiacomo/fugleramme/blob/main/assets/artwork/classic/ATTRIBUTION.md';
    var fuglerammeCreator = 'https://github.com/arnegiacomo/fugleramme';

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

    function loadCatalog(complete, forCollage) {
        var state = forCollage ? collageCatalogState : catalogState;
        var cached = forCollage ? collageCatalog : catalog;
        var waiters = forCollage ? collageCatalogWaiters : catalogWaiters;
        var path = forCollage ? collageCatalogPath : catalogPath;
        if (state === 'ready' || state === 'failed') {
            complete(cached);
            return;
        }
        waiters.push(complete);
        if (state === 'loading') {
            return;
        }

        if (forCollage) {
            collageCatalogState = 'loading';
        } else {
            catalogState = 'loading';
        }
        var request;
        var completed = false;

        function finish(value) {
            if (completed) {
                return;
            }
            completed = true;
            var prepared = prepareCatalog(value);
            if (forCollage) {
                collageCatalog = prepared;
                collageCatalogState = prepared ? 'ready' : 'failed';
                waiters = collageCatalogWaiters;
                collageCatalogWaiters = [];
            } else {
                catalog = prepared;
                catalogState = prepared ? 'ready' : 'failed';
                waiters = catalogWaiters;
                catalogWaiters = [];
            }
            waiters.forEach(function (waiter) {
                waiter(prepared);
            });
        }

        try {
            request = new XMLHttpRequest();
            request.timeout = 12000;
            request.open('GET', path, true);
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
        var allowedPath = kind === 'perch' ? /^perches\/[a-z0-9_-]+\.png$/ : /^birds\/[a-z0-9_-]+\.png$/;
        if (!record || typeof record.path !== 'string' || !allowedPath.test(record.path) ||
                typeof record.source !== 'string' || record.source.length > 80 || !safeSourceUrl(record.sourceUrl)) {
            return null;
        }
        var subject = safeWorkSubject(workSubject);
        return {
            kind: kind,
            image: 'assets/artwork/' + record.path,
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

    function birdImages(species, source, stableChoice) {
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
            var selectedIndex = stableChoice ? Number(species.id) % records.length : Math.floor(Math.random() * records.length);
            var selectedRecord = records.splice(selectedIndex, 1)[0];
            records.unshift(selectedRecord);
            selectedBirdImages[name] = selectedRecord.image;
        } else if (records.length) {
            selectedBirdImages[name] = records[0].image;
        }
        return records;
    }

    function perchCredits(source, speciesKey) {
        if (!perchOrder) {
            perchOrder = source.perches.slice(0);
            for (var index = perchOrder.length - 1; index > 0; index -= 1) {
                var swap = Math.floor(Math.random() * (index + 1));
                var item = perchOrder[index];
                perchOrder[index] = perchOrder[swap];
                perchOrder[swap] = item;
            }
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
        if (speciesKey) {
            var selectedSpeciesPerch = selectedSpeciesPerches[speciesKey];
            if (!selectedSpeciesPerch && records.length) {
                var randomIndex = Math.floor(Math.random() * records.length);
                selectedSpeciesPerch = records[randomIndex].image;
                selectedSpeciesPerches[speciesKey] = selectedSpeciesPerch;
            }
            if (selectedSpeciesPerch) {
                records.sort(function (first, second) {
                    return first.image === selectedSpeciesPerch ? -1 : second.image === selectedSpeciesPerch ? 1 : 0;
                });
            }
        } else if (selectedPerchPath) {
            records.sort(function (first, second) {
                return first.image === selectedPerchPath ? -1 : second.image === selectedPerchPath ? 1 : 0;
            });
        }
        return records;
    }

    function paint(image, species, onCreditChange) {
        image._birdweatherPaintRequest = (image._birdweatherPaintRequest || 0) + 1;
        var requestId = image._birdweatherPaintRequest;
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
            var candidateIndex = 0;
            var perchFallbackStarted = false;

            function showNext() {
                if (image._birdweatherPaintRequest !== requestId) {
                    return;
                }
                var credit = candidates[candidateIndex];
                candidateIndex += 1;
                if (!credit) {
                    if (species && source && !perchFallbackStarted) {
                        perchFallbackStarted = true;
                        candidates = perchCredits(source, normalizeName(species.scientificName));
                        candidateIndex = 0;
                        showNext();
                        return;
                    }
                    image.onload = image.onerror = null;
                    image.classList.remove('artwork-loading');
                    image.setAttribute('src', sprig);
                    onCreditChange(null);
                    return;
                }
                if (image.getAttribute('src') === credit.image && image.complete && image.naturalWidth) {
                    image.classList.remove('artwork-loading');
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
                image.setAttribute('src', credit.image);
            }

            showNext();
        });
    }

    function collageImagePath(credit) {
        return /^assets\/artwork\/(?:birds|perches)\/[a-z0-9_-]+\.png$/.test(credit.image) ? credit.image : null;
    }

    function paintCollage(image, species, onCreditChange) {
        image._birdweatherPaintRequest = (image._birdweatherPaintRequest || 0) + 1;
        var requestId = image._birdweatherPaintRequest;
        image.onload = image.onerror = null;
        image.setAttribute('referrerpolicy', 'no-referrer');
        image.classList.add('artwork-loading');
        onCreditChange(null, false);

        loadCatalog(function (source) {
            if (image._birdweatherPaintRequest !== requestId) {
                return;
            }
            var records = species ? birdImages(species, source || { birds: {}, aliases: {} }, true) :
                source ? perchCredits(source) : [];
            var candidateIndex = 0;
            var perchFallbackStarted = false;

            function showNext() {
                if (image._birdweatherPaintRequest !== requestId) {
                    return;
                }
                var credit = records[candidateIndex];
                candidateIndex += 1;
                if (!credit) {
                    if (species && source && !perchFallbackStarted) {
                        perchFallbackStarted = true;
                        records = perchCredits(source, normalizeName(species.scientificName));
                        candidateIndex = 0;
                        showNext();
                        return;
                    }
                    image.onload = image.onerror = null;
                    image.classList.remove('artwork-loading');
                    image.removeAttribute('src');
                    onCreditChange(null, true);
                    return;
                }
                var imagePath = collageImagePath(credit);
                if (!imagePath || failedImages[imagePath]) {
                    showNext();
                    return;
                }
                credit.image = imagePath;
                if (image.getAttribute('src') === imagePath && image.complete && image.naturalWidth) {
                    image.classList.remove('artwork-loading');
                    if (!species) {
                        selectedPerchPath = imagePath;
                    }
                    onCreditChange(credit, true);
                    return;
                }
                image.onload = function () {
                    image.onload = image.onerror = null;
                    if (image._birdweatherPaintRequest !== requestId) {
                        return;
                    }
                    image.classList.remove('artwork-loading');
                    if (!species) {
                        selectedPerchPath = imagePath;
                    }
                    onCreditChange(credit, true);
                };
                image.onerror = function () {
                    image.onload = image.onerror = null;
                    failedImages[imagePath] = true;
                    showNext();
                };
                image.setAttribute('src', imagePath);
            }

            showNext();
        }, true);
    }

    function localCredits() {
        var source = catalog || collageCatalog;
        if (!source) {
            return [];
        }
        return ['Erithacus rubecula', 'Turdus merula', 'Parus major', 'Cyanistes caeruleus']
            .map(function (scientificName) {
                var entry = source.birds[normalizeName(scientificName)];
                var image = entry && entry.images && entry.images[0];
                if (!entry || !image) {
                    return null;
                }
                var subject = entry.commonName + ' (' + entry.scientificName + ')';
                var credit = safeImageRecord(image, source, 'bird', subject);
                if (credit) {
                    credit.species = scientificName;
                }
                return credit;
            }).filter(function (credit) { return !!credit; });
    }

    window.BirdWeatherArtwork = {
        paint: paint,
        paintCollage: paintCollage,
        localCredits: function () {
            return localCredits();
        }
    };
}(window));
