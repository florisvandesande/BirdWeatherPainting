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
        var plates = Object.create(null);
        var displayOrder = [];
        var layout = { width: 0, height: 0 };
        var generation = 0;
        board.setAttribute('role', 'list');

        function randomGenerator(seedText) {
            var seed = 17;
            var index;
            for (index = 0; index < seedText.length; index += 1) {
                seed = (seed * 31 + seedText.charCodeAt(index)) % 233280;
            }
            return function () {
                seed = (seed * 9301 + 49297) % 233280;
                return seed / 233280;
            };
        }

        function shape(bounds, count) {
            var aspect = bounds.width / Math.max(1, bounds.height);
            var columns = Math.max(1, Math.round(Math.sqrt(count * aspect)));
            var rows = Math.ceil(count / columns);
            return {
                width: Math.min(0.96 / columns, 0.28),
                height: Math.min(0.9 / rows, aspect < 1 ? 0.24 : 0.32),
                aspect: aspect
            };
        }

        function visibleRegions(position, width, height) {
            var top = position.y - height / 2;
            var imageWidth = width * 0.64;
            var captionWidth = width * 0.74;
            var imageSplit = top + height * 0.6;
            var captionTop = top + height * 0.62;
            return [
                {
                    left: position.x - imageWidth / 2,
                    right: position.x + imageWidth / 2,
                    top: top,
                    bottom: imageSplit
                },
                {
                    left: position.x - captionWidth / 2,
                    right: position.x + captionWidth / 2,
                    top: captionTop,
                    bottom: top + height
                }
            ];
        }

        function rectanglesOverlap(first, second) {
            return first.left < second.right + 0.003 && first.right > second.left - 0.003 &&
                first.top < second.bottom + 0.003 && first.bottom > second.top - 0.003;
        }

        function overlaps(first, second, width, height) {
            var firstRegions = visibleRegions(first, width, height);
            var secondRegions = visibleRegions(second, width, height);
            return rectanglesOverlap(firstRegions[0], secondRegions[1]) ||
                rectanglesOverlap(firstRegions[1], secondRegions[0]) ||
                rectanglesOverlap(firstRegions[1], secondRegions[1]);
        }

        function fits(positionList, candidateLayout) {
            var index;
            var other;
            for (index = 0; index < positionList.length; index += 1) {
                var position = positionList[index].position;
                if (position.x < candidateLayout.width / 2 ||
                    position.x > 1 - candidateLayout.width / 2 ||
                    position.y < candidateLayout.height / 2 ||
                    position.y > 1 - candidateLayout.height / 2) {
                    return false;
                }
                for (other = 0; other < index; other += 1) {
                    if (overlaps(position, positionList[other].position,
                        candidateLayout.width, candidateLayout.height)) {
                        return false;
                    }
                }
            }
            return true;
        }

        function fitShape(bounds, count, positionList) {
            var fitted = shape(bounds, Math.max(1, count));
            var attempts = 0;
            while (!fits(positionList, fitted) && attempts < 28) {
                fitted.width *= 0.94;
                fitted.height *= 0.94;
                attempts += 1;
            }
            return fitted;
        }

        function existingPlates() {
            return displayOrder.map(function (id) { return plates[id]; }).filter(function (plate) {
                return !!plate && !!plate.position;
            });
        }

        function findPosition(species, bounds, positionList) {
            var random = randomGenerator(species.id);
            var candidateCount = 288;
            var pass;
            for (pass = 0; pass < 18; pass += 1) {
                var candidates = [];
                var clusteredCandidates = [];
                var bestDistance = 0;
                var candidateIndex;
                var horizontalMargin = layout.width / 2;
                var verticalMargin = layout.height / 2;

                if (positionList.length >= 2) {
                    var anchorIndex;
                    for (anchorIndex = 0; anchorIndex < positionList.length; anchorIndex += 1) {
                        var variant;
                        for (variant = 0; variant < 3; variant += 1) {
                            var side = random() < 0.5 ? -1 : 1;
                            var anchor = positionList[anchorIndex].position;
                            var clustered = {
                                x: anchor.x + side * layout.width * (0.72 + random() * 0.08),
                                y: anchor.y + (random() - 0.5) * layout.height * 0.9
                            };
                            if (clustered.x < horizontalMargin || clustered.x > 1 - horizontalMargin ||
                                clustered.y < verticalMargin || clustered.y > 1 - verticalMargin) {
                                continue;
                            }
                            var clusterIsClear = true;
                            var placedIndex;
                            for (placedIndex = 0; placedIndex < positionList.length; placedIndex += 1) {
                                if (overlaps(clustered, positionList[placedIndex].position,
                                    layout.width, layout.height)) {
                                    clusterIsClear = false;
                                    break;
                                }
                            }
                            if (clusterIsClear) {
                                clusteredCandidates.push(clustered);
                            }
                        }
                    }
                    if (clusteredCandidates.length && random() < 0.78) {
                        return clusteredCandidates[Math.floor(random() * clusteredCandidates.length)];
                    }
                }

                for (candidateIndex = 0; candidateIndex < candidateCount; candidateIndex += 1) {
                    var candidate = {
                        x: horizontalMargin + random() * (1 - horizontalMargin * 2),
                        y: verticalMargin + random() * (1 - verticalMargin * 2)
                    };
                    var isClear = true;
                    var nearestDistance = Infinity;
                    var index;
                    for (index = 0; index < positionList.length; index += 1) {
                        var placed = positionList[index].position;
                        if (overlaps(candidate, placed, layout.width, layout.height)) {
                            isClear = false;
                            break;
                        }
                        var horizontal = (candidate.x - placed.x) * bounds.width;
                        var vertical = (candidate.y - placed.y) * bounds.height;
                        nearestDistance = Math.min(nearestDistance,
                            Math.sqrt(horizontal * horizontal + vertical * vertical));
                    }
                    if (!isClear) {
                        continue;
                    }
                    if (!positionList.length) {
                        var centerX = (candidate.x - 0.5) * bounds.width;
                        var centerY = (candidate.y - 0.5) * bounds.height;
                        nearestDistance = Math.sqrt(centerX * centerX + centerY * centerY);
                    }
                    candidates.push({ position: candidate, distance: nearestDistance });
                    bestDistance = Math.max(bestDistance, nearestDistance);
                }
                if (candidates.length) {
                    var minimumBoardDimension = Math.min(bounds.width, bounds.height);
                    var minimumDistance = !positionList.length ?
                        Math.max(minimumBoardDimension * 0.25, bestDistance * 0.3) :
                        (positionList.length === 1 ?
                            Math.max(minimumBoardDimension * 0.42, bestDistance * 0.38) :
                            Math.max(minimumBoardDimension * 0.03, bestDistance * 0.2));
                    var eligible = candidates.filter(function (entry) {
                        return entry.distance >= minimumDistance;
                    });
                    if (!eligible.length) {
                        eligible = candidates;
                    }
                    return eligible[Math.floor(random() * eligible.length)].position;
                }
                layout.width *= 0.94;
                layout.height *= 0.94;
            }
            return { x: 0.5, y: 0.5 };
        }

        function textSize(bounds) {
            var longestName = 1;
            displayOrder.forEach(function (id) {
                var plate = plates[id];
                if (plate) {
                    longestName = Math.max(longestName, plate.name.textContent.length,
                        plate.species.scientificName.length);
                }
            });
            var plateWidth = bounds.width * layout.width;
            var plateHeight = bounds.height * layout.height;
            var widthSize = plateWidth * 0.9 / (longestName * 0.55);
            var heightSize = plateHeight * 0.4;
            return Math.max(7, Math.min(20, widthSize, heightSize));
        }

        function place(plate, fontSize) {
            if (!plate.position) {
                return;
            }
            plate.item.style.left = (plate.position.x * 100 - layout.width * 50) + '%';
            plate.item.style.top = (plate.position.y * 100 - layout.height * 50) + '%';
            plate.item.style.width = (layout.width * 100) + '%';
            plate.item.style.height = (layout.height * 100) + '%';
            plate.figure.style.fontSize = fontSize + 'px';
        }

        function layoutPlates() {
            var bounds = board.getBoundingClientRect();
            if (!bounds.width || !bounds.height || !displayOrder.length) {
                return;
            }
            layout = fitShape(bounds, displayOrder.length, existingPlates());
            var fontSize = textSize(bounds);
            displayOrder.forEach(function (id) {
                var plate = plates[id];
                if (plate) {
                    place(plate, fontSize);
                }
            });
        }

        function makePlate(species, position) {
            var item = document.createElement('li');
            item.className = 'collage-item';
            item.setAttribute('role', 'listitem');

            var figure = document.createElement('figure');
            figure.className = 'collage-specimen';
            figure.setAttribute('data-species-id', species.id);
            var artworkFrame = document.createElement('div');
            artworkFrame.className = 'collage-image';
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
            artworkFrame.appendChild(image);
            figure.appendChild(artworkFrame);
            figure.appendChild(caption);
            item.appendChild(figure);
            board.appendChild(item);

            var plate = {
                item: item,
                figure: figure,
                image: image,
                name: name,
                species: species,
                position: position
            };
            plates[species.id] = plate;
            var createdAt = generation;
            artwork.paint(image, species, function (credit) {
                if (createdAt !== generation || plates[species.id] !== plate) {
                    return;
                }
                figure.classList.toggle('collage-name-plate', !credit);
            });
            return plate;
        }

        function removePlate(id) {
            var plate = plates[id];
            if (!plate) {
                return;
            }
            plate.image.onload = plate.image.onerror = null;
            if (plate.item.parentNode === board) {
                board.removeChild(plate.item);
            }
            delete plates[id];
        }

        function clear() {
            generation += 1;
            Object.keys(plates).forEach(removePlate);
            plates = Object.create(null);
            displayOrder = [];
            board.textContent = '';
            collage.hidden = true;
            latest.hidden = false;
            painting.setAttribute('aria-labelledby', 'plate-title');
        }

        function show(result, locale) {
            if (!result.species.length) {
                if (displayOrder.length) {
                    clear();
                }
                return;
            }

            collage.hidden = false;
            latest.hidden = true;
            var bounds = board.getBoundingClientRect();
            var selected = Object.create(null);
            result.species.forEach(function (species) {
                selected[species.id] = true;
            });
            Object.keys(plates).forEach(function (id) {
                if (!selected[id]) {
                    removePlate(id);
                }
            });

            displayOrder = result.species.map(function (species) { return species.id; });
            layout = fitShape(bounds, displayOrder.length, existingPlates());
            result.species.forEach(function (species) {
                var plate = plates[species.id];
                if (!plate) {
                    var position = findPosition(species, bounds, existingPlates());
                    plate = makePlate(species, position);
                }
                plate.species = species;
                var common = text.speciesName(locale, species);
                if (plate.name.textContent !== common.name) {
                    plate.name.textContent = common.name;
                    plate.name.setAttribute('lang', common.language);
                    plate.name.title = common.name;
                }
                plate.figure.querySelector('.collage-scientific-name').textContent = species.scientificName;
            });

            title.textContent = text.message(locale, 'displayViewToday');
            painting.setAttribute('aria-labelledby', 'collage-title');
            layoutPlates();
        }

        if (window.addEventListener) {
            window.addEventListener('resize', layoutPlates);
        }

        return { show: show, clear: clear };
    }

    window.BirdWeatherCollageView = { create: create };
}(window, document));
