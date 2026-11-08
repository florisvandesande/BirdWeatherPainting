(function (window, document) {
    'use strict';

    var artwork = window.BirdWeatherArtwork;
    var text = window.BirdWeatherText;
    var layout = window.BirdWeatherCollageLayout;

    function create() {
        var painting = document.getElementById('painting');
        var latest = document.getElementById('latest-plate');
        var emptyState = document.getElementById('collage-empty-state');
        var emptyArt = document.getElementById('collage-empty-art');
        var collage = document.getElementById('collage');
        var board = document.getElementById('collage-board');
        var omitted = document.getElementById('collage-omitted');
        var activeLayer = null;
        var activePlates = [];
        var contentKey = '';
        var generation = 0;
        var resizeTimer = null;
        var lastResult = null;
        var lastLocale = null;

        function labelPaintingAsCollage(locale) {
            painting.removeAttribute('aria-labelledby');
            painting.setAttribute('aria-label', text.message(locale, 'displayViewToday'));
        }

        function createLayer(staging) {
            var layer = document.createElement('div');
            layer.className = staging ? 'collage-layer collage-layer-staging' : 'collage-layer collage-layer-active';
            layer.setAttribute('aria-hidden', 'true');
            board.appendChild(layer);
            return layer;
        }

        function makePlate(layer, species, locale, plates, createdAt, onReady) {
            var figure = document.createElement('figure');
            figure.className = 'collage-specimen';
            var image = document.createElement('img');
            image.alt = '';
            image.draggable = false;
            var caption = document.createElement('figcaption');
            caption.dir = 'auto';
            var name = document.createElement('span');
            name.className = 'collage-common-name';
            var common = text.speciesName(locale, species);
            name.textContent = common.name;
            name.setAttribute('lang', common.language);
            name.title = common.name;
            caption.appendChild(name);
            var scientific = document.createElement('i');
            scientific.className = 'collage-scientific-name';
            scientific.textContent = species.scientificName;
            caption.appendChild(scientific);
            figure.appendChild(image);
            figure.appendChild(caption);
            layer.appendChild(figure);
            var plate = { figure: figure, image: image, caption: caption, name: name, species: species, ready: false };
            plates.push(plate);
            artwork.paintCollage(image, species, function (ignoredCredit, ready) {
                if (createdAt !== generation || plate.ready || !ready) {
                    return;
                }
                figure.classList.toggle('collage-name-plate', !ignoredCredit);
                plate.ready = true;
                onReady();
            });
        }

        function cancelPending() {
            generation += 1;
            var pending = board.querySelector('.collage-layer-staging');
            if (pending) {
                pending.querySelectorAll('img').forEach(function (image) {
                    image.onload = image.onerror = null;
                });
                pending.remove();
            }
            return generation;
        }

        function scaleActiveToBoard(width, height) {
            if (!activeLayer || !activeLayer.dataset.layoutWidth || !activeLayer.dataset.layoutHeight) {
                return;
            }
            var oldWidth = Number(activeLayer.dataset.layoutWidth);
            var oldHeight = Number(activeLayer.dataset.layoutHeight);
            var scale = Math.min(1, width / oldWidth, height / oldHeight);
            var x = Math.floor((width - oldWidth * scale) / 2);
            var y = Math.floor((height - oldHeight * scale) / 2);
            activeLayer.style.transformOrigin = 'top left';
            activeLayer.style.transform = 'translate(' + x + 'px, ' + y + 'px) scale(' + scale + ')';
            activeLayer.style.width = oldWidth + 'px';
            activeLayer.style.height = oldHeight + 'px';
        }

        function show(result, locale) {
            lastResult = result;
            lastLocale = locale;
            if (!result.species.length) {
                cancelPending();
                if (activeLayer) {
                    activeLayer.remove();
                    activeLayer = null;
                    activePlates = [];
                }
                contentKey = '';
                omitted.hidden = true;
                emptyState.hidden = false;
                emptyState.setAttribute('role', 'img');
                emptyState.setAttribute('aria-label', text.message(locale, 'perch'));
                board.hidden = true;
                collage.hidden = false;
                latest.hidden = true;
                labelPaintingAsCollage(locale);
                return;
            }

            emptyState.hidden = true;
            board.hidden = false;
            emptyArt.hidden = true;
            collage.hidden = false;
            latest.hidden = true;
            omitted.textContent = result.omitted ? text.message(locale,
                result.omitted === 1 ? 'collageOneOmitted' : 'collageOmitted', { count: result.omitted }) : '';
            omitted.hidden = !result.omitted;
            labelPaintingAsCollage(locale);

            var rect = board.getBoundingClientRect();
            var width = Math.max(1, Math.floor(rect.width));
            var height = Math.max(1, Math.floor(rect.height));
            var keyParts = result.species.map(function (bird) {
                var common = text.speciesName(locale, bird);
                return [bird.id, bird.scientificName, common.name, common.language].join('|');
            });
            var key = JSON.stringify(keyParts) + ':' + locale + ':' + width + 'x' + height;
            if (key === contentKey) {
                return;
            }

            var currentGeneration = cancelPending();
            if (activeLayer) {
                scaleActiveToBoard(width, height);
            }
            var staging = createLayer(true);
            var plates = [];
            var remaining = result.species.length;
            var completed = false;
            function ready() {
                if (completed || currentGeneration !== generation || remaining < 1) {
                    return;
                }
                remaining -= 1;
                if (remaining) {
                    return;
                }
                layout.arrange(plates, board, function (packed) {
                    if (completed || currentGeneration !== generation) {
                        return;
                    }
                    completed = true;
                    if (!packed) {
                        staging.remove();
                        return;
                    }
                    window.requestAnimationFrame(function () {
                        if (currentGeneration !== generation) {
                            staging.remove();
                            return;
                        }
                        var previous = activeLayer;
                        staging.className = 'collage-layer collage-layer-active';
                        staging.dataset.layoutWidth = String(width);
                        staging.dataset.layoutHeight = String(height);
                        staging.style.width = '';
                        staging.style.height = '';
                        staging.style.transform = '';
                        staging.style.transformOrigin = '';
                        activeLayer = staging;
                        activePlates = plates;
                        contentKey = key;
                        if (previous) {
                            previous.remove();
                        }
                    });
                });
            }
            result.species.forEach(function (species) {
                makePlate(staging, species, locale, plates, currentGeneration, ready);
            });
        }

        function clear() {
            cancelPending();
            if (activeLayer) {
                activeLayer.remove();
                activeLayer = null;
            }
            activePlates = [];
            contentKey = '';
            lastResult = null;
            lastLocale = null;
            board.classList.remove('collage-packed');
            emptyState.hidden = true;
            board.hidden = false;
            emptyArt.hidden = true;
            collage.hidden = true;
            latest.hidden = false;
            omitted.hidden = true;
            painting.removeAttribute('aria-label');
            painting.setAttribute('aria-labelledby', 'plate-title');
        }

        function handleResize() {
            if (resizeTimer) {
                window.clearTimeout(resizeTimer);
            }
            resizeTimer = window.setTimeout(function () {
                resizeTimer = null;
                if (lastResult && lastResult.species.length) {
                    show(lastResult, lastLocale);
                }
            }, 120);
        }

        window.addEventListener('resize', handleResize);
        window.addEventListener('orientationchange', handleResize);

        function showEmpty(locale) {
            cancelPending();
            if (activeLayer) {
                activeLayer.remove();
                activeLayer = null;
            }
            activePlates = [];
            contentKey = '';
            lastResult = null;
            lastLocale = locale;
            collage.hidden = false;
            latest.hidden = true;
            emptyState.hidden = false;
            emptyState.setAttribute('role', 'img');
            emptyState.setAttribute('aria-label', text.message(locale, 'perch'));
            board.hidden = true;
            emptyArt.hidden = false;
            omitted.hidden = true;
            labelPaintingAsCollage(locale);
        }

        function paintEmpty(complete) {
            var createdAt = generation;
            artwork.paintCollage(emptyArt, null, function (credit, ready) {
                if (ready && createdAt === generation) {
                    complete();
                }
            });
        }

        return { show: show, showEmpty: showEmpty, paintEmpty: paintEmpty, clear: clear };
    }

    window.BirdWeatherCollageView = { create: create };
}(window, document));
