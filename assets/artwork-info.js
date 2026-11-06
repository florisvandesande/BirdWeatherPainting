(function (window, document) {
    'use strict';

    var artwork = window.BirdWeatherArtwork;
    var text = window.BirdWeatherArtworkText;
    var button = document.getElementById('artwork-button');
    var painting = document.getElementById('painting');
    var dialog = document.getElementById('artwork-info');
    var closeButton = document.getElementById('artwork-close');
    var displayCredits = document.getElementById('artwork-displayed');
    var localCredits = document.getElementById('artwork-local');
    var list = document.getElementById('artwork-missing');
    var empty = document.getElementById('artwork-missing-empty');
    var select = document.getElementById('artwork-select');
    var copyHelp = document.getElementById('artwork-copy-help');
    var locale = 'en';
    var displayed = [];

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

    function addCredit(parent, credit) {
        var speciesLabel = credit.speciesTextKey ? text.message(locale, credit.speciesTextKey) : credit.species;
        var heading = append(parent, 'h4', speciesLabel);
        heading.dir = 'auto';
        var fields = append(parent, 'dl', '');
        if (credit.title) {
            label(fields, 'work', credit.title + ' · ' + credit.work);
        }
        label(fields, 'artist', credit.creator, credit.creatorUrl);
        if (credit.collection) {
            label(fields, 'collection', credit.collection, credit.collectionUrl);
        }
        label(fields, 'source', text.message(locale, 'sourceLink'), credit.source);
        label(fields, 'license', credit.license, credit.licenseUrl);
        label(fields, 'edits', text.message(locale, credit.edits));
    }

    function renderCredits() {
        displayCredits.textContent = '';
        localCredits.textContent = '';
        if (!displayed.length) {
            append(displayCredits, 'p', text.message(locale, 'noDisplayed'));
        }
        displayed.forEach(function (credit) {
            addCredit(displayCredits, credit);
        });
        artwork.localCredits().forEach(function (credit) {
            if (displayed.indexOf(credit) === -1) {
                addCredit(localCredits, credit);
            }
        });
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

    function setLocale(value) {
        locale = value;
        var labels = document.querySelectorAll('[data-artwork-text]');
        for (var index = 0; index < labels.length; index += 1) {
            var item = labels[index];
            item.textContent = text.message(locale, item.getAttribute('data-artwork-text'));
        }
        button.setAttribute('aria-label', text.message(locale, 'title'));
        if (!dialog.hidden) {
            renderCredits();
            renderMissing();
        }
    }

    function setDisplayed(credits) {
        var next = credits.filter(function (credit) {
            return !!credit;
        });
        var changed = next.length !== displayed.length || next.some(function (credit, index) {
            return credit !== displayed[index];
        });
        displayed = next;
        if (!dialog.hidden) {
            if (changed) {
                renderCredits();
            }
            renderMissing();
        }
    }

    function open() {
        renderCredits();
        renderMissing();
        button.setAttribute('aria-expanded', 'true');
        painting.classList.add('artwork-open');
        dialog.hidden = false;
        dialog.scrollTop = 0;
        closeButton.focus();
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

    window.BirdWeatherArtworkInfo = { setLocale: setLocale, setDisplayed: setDisplayed, close: close };
}(window, document));
