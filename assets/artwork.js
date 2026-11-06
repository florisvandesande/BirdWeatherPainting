(function (window) {
    'use strict';

    var storagePrefix = 'birdweather-missing-artwork:';
    var sprig = 'assets/field-sprig.svg';
    var missingInSession = Object.create(null);
    var storageUnavailable = false;
    var commons = 'https://commons.wikimedia.org/wiki/File:Nederlandsche_vogelen_(KB)_-_';
    var publicDomain = 'https://creativecommons.org/publicdomain/mark/1.0/';

    function historicalPlate(species, file, title, work, source) {
        return {
            species: species,
            image: 'assets/plates/' + file + '.jpg',
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
        image.onload = image.onerror = null;
        image.setAttribute('referrerpolicy', 'no-referrer');
        if (!species) {
            image.classList.remove('artwork-loading');
            image.setAttribute('src', sprig);
            onCreditChange(null);
            return;
        }

        function show(credit) {
            if (!credit) {
                image.classList.remove('artwork-loading');
                image.setAttribute('src', sprig);
                setMissing(species, true);
                onCreditChange(null);
                return;
            }
            if (image.getAttribute('src') === credit.image && image.complete && image.naturalWidth) {
                setMissing(species, false);
                onCreditChange(credit);
                return;
            }
            // A new caption should never be paired with the previous bird while an image loads.
            image.classList.add('artwork-loading');
            onCreditChange(null);
            image.onload = function () {
                image.onload = image.onerror = null;
                image.classList.remove('artwork-loading');
                setMissing(species, false);
                onCreditChange(credit);
            };
            image.onerror = function () {
                image.onload = image.onerror = null;
                show(credit.edits === 'historicalEdits' ? remotePlate(species) : null);
            };
            image.setAttribute('src', credit.image);
        }

        var historical = Object.prototype.hasOwnProperty.call(plates, species.scientificName) && plates[species.scientificName];
        show(historical || remotePlate(species));
    }

    readMissing();

    window.BirdWeatherArtwork = {
        paint: paint,
        localCredits: function () {
            return entries(plates);
        },
        missingSpecies: function () {
            return entries(readMissing());
        }
    };
}(window));
