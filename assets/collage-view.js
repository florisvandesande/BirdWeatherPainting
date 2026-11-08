(function (window, document) {
    'use strict';

    var artwork = window.BirdWeatherArtwork;
    var artworkInfo = window.BirdWeatherArtworkInfo;
    var text = window.BirdWeatherText;
    var layout = window.BirdWeatherCollageLayout;

    function create() {
        var painting = document.getElementById('painting');
        var latest = document.getElementById('latest-plate');
        var emptyState = document.getElementById('collage-empty-state');
        var emptyArt = document.getElementById('collage-empty-art');
        var emptyTitle = document.getElementById('collage-empty-title');
        var emptyDetail = document.getElementById('collage-empty-detail');
        var collage = document.getElementById('collage');
        var title = document.getElementById('collage-title');
        var board = document.getElementById('collage-board');
        var omitted = document.getElementById('collage-omitted');
        var plates = [];
        var contentKey = '';
        var generation = 0;
        var resizeTimer = null;
        var arranged = false;
        var arrangementFailed = false;
        var lastResult = null;
        var lastLocale = null;
        var building = false;

        function publishCredits() {
            artworkInfo.setDisplayed(plates.map(function (plate) { return plate.credit; }));
        }

        function makePlate(species) {
            var figure = document.createElement('figure');
            figure.className = 'collage-specimen';
            var artWindow = document.createElement('span');
            artWindow.className = 'collage-art-window';
            var image = document.createElement('img');
            image.alt = '';
            artWindow.appendChild(image);
            var caption = document.createElement('figcaption');
            caption.dir = 'auto';
            var name = document.createElement('span');
            name.className = 'collage-common-name';
            caption.appendChild(name);
            var scientific = document.createElement('i');
            scientific.className = 'collage-scientific-name';
            scientific.textContent = species.scientificName;
            caption.appendChild(scientific);
            figure.appendChild(artWindow);
            figure.appendChild(caption);
            board.appendChild(figure);
            var plate = {
                figure: figure,
                artWindow: artWindow,
                image: image,
                caption: caption,
                name: name,
                species: species,
                credit: null,
                ready: false
            };
            plates.push(plate);
            var createdAt = generation;
            artwork.paintCollage(image, species, function (credit, ready) {
                if (createdAt !== generation) {
                    return;
                }
                if (ready) {
                    figure.classList.toggle('collage-name-plate', !credit);
                    plate.credit = credit;
                    plate.ready = true;
                    publishCredits();
                    arrangeIfReady();
                }
            });
        }

        function arrangeIfReady() {
            if (building || arranged || arrangementFailed || !plates.length ||
                    !plates.every(function (plate) { return plate.ready; })) {
                return;
            }
            var currentGeneration = generation;
            layout.arrange(plates, board, function (packed) {
                if (currentGeneration !== generation) {
                    return;
                }
                arranged = packed;
                arrangementFailed = !packed;
                board.classList.toggle('collage-packed', packed);
            });
        }

        function clear() {
            generation += 1;
            plates.forEach(function (plate) {
                plate.image.onload = plate.image.onerror = null;
            });
            plates = [];
            contentKey = '';
            arranged = false;
            arrangementFailed = false;
            building = false;
            board.textContent = '';
            board.classList.remove('collage-packed');
            emptyState.hidden = true;
            board.hidden = false;
            emptyArt.hidden = true;
            collage.hidden = true;
            latest.hidden = false;
            omitted.hidden = true;
            painting.setAttribute('aria-labelledby', 'plate-title');
            publishCredits();
        }

        function show(result, locale) {
            if (!result.species.length) {
                if (contentKey) {
                    clear();
                }
                title.textContent = text.message(locale, 'displayViewToday');
                omitted.hidden = true;
                emptyState.hidden = false;
                board.hidden = true;
                collage.hidden = false;
                latest.hidden = true;
                painting.setAttribute('aria-labelledby', 'collage-title');
                lastResult = result;
                lastLocale = locale;
                return;
            }
            emptyState.hidden = true;
            board.hidden = false;
            emptyArt.hidden = true;
            collage.hidden = false;
            latest.hidden = true;
            lastResult = result;
            lastLocale = locale;
            var rect = board.getBoundingClientRect();
            var retainedIds = result.species.map(function (bird) { return bird.id; }).sort();
            var key = JSON.stringify(retainedIds) + ':' + locale + ':' +
                Math.round(rect.width) + 'x' + Math.round(rect.height);
            if (key !== contentKey) {
                clear();
                contentKey = key;
                collage.hidden = false;
                latest.hidden = true;
                building = true;
                result.species.forEach(makePlate);
                building = false;
            }
            plates.forEach(function (plate) {
                var common = text.speciesName(locale, plate.species);
                if (plate.name.textContent !== common.name) {
                    plate.name.textContent = common.name;
                    plate.name.setAttribute('lang', common.language);
                    plate.name.title = common.name;
                }
            });
            title.textContent = text.message(locale, 'displayViewToday');
            omitted.textContent = result.omitted ? text.message(locale,
                result.omitted === 1 ? 'collageOneOmitted' : 'collageOmitted',
                { count: result.omitted }) : '';
            omitted.hidden = !result.omitted;
            collage.hidden = false;
            latest.hidden = true;
            painting.setAttribute('aria-labelledby', 'collage-title');
            arrangeIfReady();
        }

        function handleResize() {
            if (resizeTimer) {
                window.clearTimeout(resizeTimer);
            }
            resizeTimer = window.setTimeout(function () {
                resizeTimer = null;
                if (contentKey && plates.length) {
                    if (lastResult) {
                        show(lastResult, lastLocale);
                    }
                }
            }, 120);
        }

        window.addEventListener('resize', handleResize);
        window.addEventListener('orientationchange', handleResize);

        function showEmpty(titleText, detailText) {
            emptyTitle.textContent = titleText;
            emptyDetail.textContent = detailText;
            collage.hidden = false;
            latest.hidden = true;
            emptyState.hidden = false;
            board.hidden = true;
            emptyArt.hidden = false;
            omitted.hidden = true;
            painting.setAttribute('aria-labelledby', 'collage-empty-title');
        }

        function paintEmpty(complete) {
            var createdAt = generation;
            artwork.paintCollage(emptyArt, null, function (credit, ready) {
                if (ready && createdAt === generation) {
                    complete(credit);
                }
            });
        }

        return { show: show, showEmpty: showEmpty, paintEmpty: paintEmpty, clear: clear };
    }

    window.BirdWeatherCollageView = { create: create };
}(window, document));
