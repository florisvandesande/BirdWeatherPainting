(function (window, document) {
    'use strict';

    var artwork = window.BirdWeatherArtwork;
    var text = window.BirdWeatherText;

    function create() {
        var painting = document.getElementById('painting');
        var latest = document.getElementById('latest-plate');
        var collage = document.getElementById('collage');
        var title = document.getElementById('collage-title');
        var board = document.getElementById('collage-board');
        var plates = [];
        var contentKey = '';
        var generation = 0;

        function makePlate(species, parent, hero) {
            var figure = document.createElement('figure');
            figure.className = 'collage-specimen';
            var image = document.createElement('img');
            image.alt = '';
            var caption = document.createElement('figcaption');
            caption.dir = 'auto';
            var name = document.createElement('span');
            name.className = 'collage-common-name';
            caption.appendChild(name);
            var scientific = document.createElement('i');
            scientific.className = 'collage-scientific-name';
            scientific.textContent = species.scientificName;
            caption.appendChild(scientific);
            figure.appendChild(image);
            figure.appendChild(caption);
            parent.appendChild(figure);
            if (hero) {
                figure.classList.add('collage-hero');
            }
            var plate = { image: image, name: name, species: species };
            plates.push(plate);
            var createdAt = generation;
            artwork.paint(image, species, function (credit) {
                if (createdAt !== generation) {
                    return;
                }
                figure.classList.toggle('collage-name-plate', !credit);
            });
        }

        function fillWing(species, side) {
            if (!species.length) {
                return;
            }
            var wing = document.createElement('ul');
            wing.className = 'collage-wing collage-' + side;
            wing.setAttribute('role', 'list');
            var columns = species.length <= 3 ? 1 : (species.length <= 9 ? 2 : 3);
            var rows = Math.ceil(species.length / columns);
            if (species.length > 9) {
                wing.classList.add('collage-dense');
            }
            species.forEach(function (bird, index) {
                var item = document.createElement('li');
                var row = Math.floor(index / columns);
                var rowSize = Math.min(columns, species.length - row * columns);
                item.style.left = ((index % columns + (columns - rowSize) / 2) * 100 / columns) + '%';
                item.style.top = (row * 100 / rows) + '%';
                item.style.width = (100 / columns) + '%';
                item.style.height = (100 / rows) + '%';
                wing.appendChild(item);
                makePlate(bird, item, false);
            });
            board.appendChild(wing);
        }

        function clear() {
            generation += 1;
            plates.forEach(function (plate) {
                plate.image.onload = plate.image.onerror = null;
            });
            plates = [];
            contentKey = '';
            board.textContent = '';
            collage.hidden = true;
            latest.hidden = false;
            painting.setAttribute('aria-labelledby', 'plate-title');
        }

        function show(result, locale) {
            if (!result.species.length) {
                if (contentKey) {
                    clear();
                }
                return;
            }
            var key = JSON.stringify(result.species);
            if (key !== contentKey) {
                clear();
                contentKey = key;
                makePlate(result.species[0], board, true);
                var split = Math.ceil((result.species.length - 1) / 2) + 1;
                fillWing(result.species.slice(1, split), 'left');
                fillWing(result.species.slice(split), 'right');
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
            collage.hidden = false;
            latest.hidden = true;
            painting.setAttribute('aria-labelledby', 'collage-title');
        }

        return { show: show, clear: clear };
    }

    window.BirdWeatherCollageView = { create: create };
}(window, document));
