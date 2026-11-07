(function (window, document) {
    'use strict';

    var output = document.getElementById('test-results');
    var checks = [];
    var keepPreview = /(?:^|[?&])preview=1(?:&|$)/.test(window.location.search);
    if (keepPreview) {
        document.body.setAttribute('data-collage-preview', 'true');
    }
    var loader = window.BirdWeatherCollageData.create({ source: 'station', station: '7368' }, 2);
    var view = window.BirdWeatherCollageView.create();

    function assert(condition, message) {
        if (!condition) {
            throw new Error(message);
        }
        checks.push(message);
    }

    function detection(id, speciesId, time) {
        return {
            id: String(id),
            speciesId: String(speciesId),
            timestamp: '2026-11-07T' + time + ':00Z'
        };
    }

    function load(nodes) {
        window.__collageTest.nodes = nodes;
        return new Promise(function (resolve, reject) {
            loader.load(function (error, result) {
                if (error) {
                    reject(new Error('Daily collage data failed: ' + error));
                } else {
                    resolve(result);
                }
            });
        });
    }

    function imageReady(image) {
        if (image.complete) {
            return Promise.resolve(image);
        }
        return new Promise(function (resolve, reject) {
            var timeout = window.setTimeout(function () {
                reject(new Error('Timed out loading ' + image.src));
            }, 5000);
            image.onload = function () {
                window.clearTimeout(timeout);
                resolve(image);
            };
            image.onerror = function () {
                window.clearTimeout(timeout);
                reject(new Error('Could not load ' + image.src));
            };
        });
    }

    function waitForImages() {
        var images = Array.prototype.slice.call(document.querySelectorAll('.collage-specimen img'));
        return Promise.all(images.map(imageReady));
    }

    function ids(result) {
        return result.species.map(function (bird) { return bird.id; });
    }

    function positionsByScientificName() {
        var positions = Object.create(null);
        var birds = document.querySelectorAll('.collage-specimen');
        var boardBounds = document.getElementById('collage-board').getBoundingClientRect();
        for (var index = 0; index < birds.length; index += 1) {
            var figure = birds[index];
            var name = figure.querySelector('.collage-scientific-name').textContent;
            var bounds = figure.getBoundingClientRect();
            var centerX = (bounds.left + bounds.width / 2 - boardBounds.left) / boardBounds.width;
            var centerY = (bounds.top + bounds.height / 2 - boardBounds.top) / boardBounds.height;
            positions[name] = [Math.round(centerX * 1000) / 1000, Math.round(centerY * 1000) / 1000];
        }
        return positions;
    }

    function boxesOverlap(first, second) {
        return first.left < second.right && first.right > second.left &&
            first.top < second.bottom && first.bottom > second.top;
    }

    function checkRenderedCollage(locale, expectedNames) {
        var figures = document.querySelectorAll('.collage-specimen');
        var visibleBounds = [];
        var expectedByScientificName = Object.create(null);
        var visibleByScientificName = Object.create(null);
        expectedNames.forEach(function (species) {
            expectedByScientificName[species.scientificName] = species;
        });
        assert(figures.length === expectedNames.length, 'Every selected species has one visible plate.');
        assert(!document.querySelector('.collage-hero'), 'No species is styled as a hero.');
        var heading = document.getElementById('collage-title');
        assert(heading.classList.contains('visually-hidden') && heading.getBoundingClientRect().width <= 1,
            'The collage has no visible heading.');
        assert(!document.querySelector('.collage-omitted, hr'), 'The collage has no omitted-species note or horizontal rule.');

        for (var index = 0; index < figures.length; index += 1) {
            var figure = figures[index];
            var common = figure.querySelector('.collage-common-name');
            var scientific = figure.querySelector('.collage-scientific-name');
            var image = figure.querySelector('img');
            var expectedSpecies = expectedByScientificName[scientific.textContent];
            assert(!!expectedSpecies, 'Each visible plate maps to one selected species by its Latin name.');
            assert(!visibleByScientificName[scientific.textContent], 'Each selected species appears once.');
            visibleByScientificName[scientific.textContent] = true;
            var expected = window.BirdWeatherText.speciesName(locale, expectedSpecies);
            var imageBounds = image.getBoundingClientRect();
            var figureBounds = figure.getBoundingClientRect();
            var commonBounds = common.getBoundingClientRect();
            var scientificBounds = scientific.getBoundingClientRect();
            var captionBounds = figure.querySelector('figcaption').getBoundingClientRect();
            var style = window.getComputedStyle(figure);

            assert(common.textContent === expected.name, 'Each plate shows its localized common name.');
            assert(common.getAttribute('lang') === expected.language, 'Each common name carries its language.');
            assert(scientific.textContent === expectedSpecies.scientificName, 'Each plate shows its Latin name.');
            assert(window.getComputedStyle(scientific).display !== 'none', 'Latin names remain visible.');
            assert(imageBounds.bottom <= captionBounds.top + 1, 'Artwork and names do not overlap.');
            assert(commonBounds.bottom <= scientificBounds.top + 1, 'The common and Latin names do not overlap.');
            assert(scientificBounds.bottom <= figureBounds.bottom + 1, 'Both names fit inside each plate.');
            assert(style.backgroundColor === 'rgba(0, 0, 0, 0)' && style.borderTopWidth === '0px', 'Plates have no card background or border.');
            assert(image.naturalWidth > 0, 'The local bird artwork loaded.');
            visibleBounds.push({ artwork: imageBounds, common: commonBounds, scientific: scientificBounds });
        }
        Object.keys(expectedByScientificName).forEach(function (name) {
            assert(visibleByScientificName[name], 'Every selected species appears in the rendered collage.');
        });

        assert(document.documentElement.scrollWidth <= window.innerWidth, 'The collage does not overflow horizontally.');
        assert(document.documentElement.scrollHeight <= window.innerHeight, 'The collage does not scroll vertically.');

        for (var first = 0; first < visibleBounds.length; first += 1) {
            for (var second = first + 1; second < visibleBounds.length; second += 1) {
                var firstNames = [visibleBounds[first].common, visibleBounds[first].scientific];
                var secondNames = [visibleBounds[second].common, visibleBounds[second].scientific];
                firstNames.forEach(function (firstName) {
                    secondNames.forEach(function (secondName) {
                        assert(!boxesOverlap(firstName, secondName), 'Names on different plates do not overlap.');
                    });
                    assert(!boxesOverlap(firstName, visibleBounds[second].artwork), 'A name does not cover another bird artwork.');
                });
                secondNames.forEach(function (secondName) {
                    assert(!boxesOverlap(secondName, visibleBounds[first].artwork), 'A name does not cover another bird artwork.');
                });
            }
        }

        if (figures.length === 2) {
            var firstBounds = figures[0].getBoundingClientRect();
            var secondBounds = figures[1].getBoundingClientRect();
            var boardBounds = document.getElementById('collage-board').getBoundingClientRect();
            var horizontal = (firstBounds.left + firstBounds.width / 2) - (secondBounds.left + secondBounds.width / 2);
            var vertical = (firstBounds.top + firstBounds.height / 2) - (secondBounds.top + secondBounds.height / 2);
            assert(Math.sqrt(horizontal * horizontal + vertical * vertical) > Math.min(boardBounds.width, boardBounds.height) * 0.35,
                'The first plates are scattered across the canvas.');
        }
    }

    function checkOrganicScatter(expectedCount) {
        var figures = document.querySelectorAll('.collage-specimen');
        var boardBounds = document.getElementById('collage-board').getBoundingClientRect();
        var horizontalBands = Object.create(null);
        var verticalBands = Object.create(null);
        var index;
        for (index = 0; index < figures.length; index += 1) {
            var bounds = figures[index].getBoundingClientRect();
            var centerX = (bounds.left + bounds.width / 2 - boardBounds.left) / boardBounds.width;
            var centerY = (bounds.top + bounds.height / 2 - boardBounds.top) / boardBounds.height;
            horizontalBands[Math.round(centerX / 0.05)] = true;
            verticalBands[Math.round(centerY / 0.05)] = true;
        }
        assert(figures.length === expectedCount, 'The scatter check uses the requested number of plates.');
        assert(Object.keys(horizontalBands).length >= 7 && Object.keys(verticalBands).length >= 7,
            'Medium and large collages use scattered positions rather than a small set of regular rows and columns.');
        if (expectedCount === 12 && boardBounds.width <= 800 && boardBounds.height > boardBounds.width) {
            for (index = 0; index < figures.length; index += 1) {
                var portraitBounds = figures[index].getBoundingClientRect();
                assert(portraitBounds.width >= boardBounds.width * 0.19 &&
                    portraitBounds.height >= boardBounds.height * 0.16,
                    'Twelve-bird iPad portrait plates keep artwork and captions large enough to read.');
            }
        }
    }

    function checkWrapperOverlap(expectedCount) {
        var figures = document.querySelectorAll('.collage-specimen');
        var didOverlap = false;
        var first;
        var second;
        for (first = 0; first < figures.length; first += 1) {
            for (second = first + 1; second < figures.length; second += 1) {
                if (boxesOverlap(figures[first].getBoundingClientRect(),
                    figures[second].getBoundingClientRect())) {
                    didOverlap = true;
                    break;
                }
            }
            if (didOverlap) {
                break;
            }
        }
        assert(figures.length === expectedCount, 'The wrapper overlap check uses the requested number of plates.');
        assert(didOverlap, 'Some transparent plate wrappers overlap in the organic collage.');
    }

    function checkStationContract() {
        var call = window.__collageTest.queryCalls[0];
        assert(call.variables.stationIds.length === 1 && call.variables.stationIds[0] === '7368', 'The selected station remains the detection source.');
        assert(call.variables.period.from === '2026-11-07' && call.variables.period.to === '2026-11-07', 'The station calendar day remains the query period.');
        assert(call.variables.period.timezone === 'Europe/Amsterdam', 'The station time zone remains in the query period.');
        assert(/detections\(first: 100, stationIds: \$stationIds, period: \$period, after: \$after\)/.test(call.operation), 'The existing paginated detection query is retained.');
    }

    async function run() {
        window.__collageTest.pages = [
            { nodes: [detection(1, 1, '09:00')], pageInfo: { hasNextPage: true, endCursor: 'after-first-page' } },
            { nodes: [detection(2, 2, '10:00'), detection(3, 3, '11:00')], pageInfo: { hasNextPage: false, endCursor: null } }
        ];
        var first = await load([
            detection(1, 1, '09:00'), detection(2, 2, '10:00'), detection(3, 3, '11:00')
        ]);
        assert(first.date === '2026-11-07' && first.stationName === 'Test station', 'The result keeps its station name and local calendar date.');
        assert(first.omitted === 1, 'The configurable species limit still reports the omitted count.');
        assert(ids(first).join(',') === '2,3', 'The first collage contains the two most recently heard unique species in stable order.');
        checkStationContract();
        assert(window.__collageTest.queryCalls.length === 2 &&
            window.__collageTest.queryCalls[0].variables.after === null &&
            window.__collageTest.queryCalls[1].variables.after === 'after-first-page',
            'The daily fetch follows the existing page cursor.');

        var locales = ['en', 'nl', 'fr', 'de', 'es', 'it', 'pt-BR'];
        for (var localeIndex = 0; localeIndex < locales.length; localeIndex += 1) {
            view.show(first, locales[localeIndex]);
            await waitForImages();
            checkRenderedCollage(locales[localeIndex], first.species);
        }
        view.show(first, 'nl');
        await waitForImages();
        checkRenderedCollage('nl', first.species);
        var originalPositions = positionsByScientificName();

        var second = await load([
            detection(1, 1, '09:00'), detection(2, 2, '10:00'), detection(3, 3, '11:00'), detection(4, 4, '11:30')
        ]);
        assert(ids(second).join(',') === '3,4', 'A new unique species enters and replaces the oldest displayed species at the limit.');
        view.show(second, 'nl');
        await waitForImages();
        var afterAddition = positionsByScientificName();
        assert(JSON.stringify(afterAddition['Parus major']) === JSON.stringify(originalPositions['Parus major']), 'An existing bird keeps its placement when a new species enters.');

        var repeated = await load([
            detection(1, 1, '09:00'), detection(2, 2, '10:00'), detection(3, 3, '11:45'), detection(4, 4, '11:30')
        ]);
        assert(ids(repeated).join(',') === '3,4', 'A repeated detection does not change collage membership or order.');
        view.show(repeated, 'fr');
        await waitForImages();
        var afterRepeat = positionsByScientificName();
        assert(JSON.stringify(afterRepeat['Parus major']) === JSON.stringify(afterAddition['Parus major']), 'A repeated detection does not move an existing bird.');
        checkRenderedCollage('fr', repeated.species);

        var fifth = await load([
            detection(1, 1, '09:00'), detection(2, 2, '10:00'), detection(3, 3, '11:45'),
            detection(4, 4, '11:30'), detection(5, 5, '12:00')
        ]);
        assert(ids(fifth).join(',') === '3,5', 'A later unique species replaces the displayed species with the oldest latest detection.');
        view.show(fifth, 'en');
        await waitForImages();
        var afterReplacement = positionsByScientificName();
        assert(JSON.stringify(afterReplacement['Parus major']) === JSON.stringify(afterRepeat['Parus major']), 'A surviving bird keeps its placement when another species is replaced.');
        checkRenderedCollage('en', fifth.species);

        var maximumLoader = window.BirdWeatherCollageData.create({ source: 'station', station: '7368' }, 32);
        var maximumNodes = [];
        for (var birdId = 1; birdId <= 33; birdId += 1) {
            var minute = birdId < 10 ? '0' + birdId : String(birdId);
            maximumNodes.push(detection(100 + birdId, birdId, '12:' + minute));
        }
        window.__collageTest.nodes = maximumNodes;
        var maximum = await new Promise(function (resolve, reject) {
            maximumLoader.load(function (error, result) {
                if (error) {
                    reject(new Error('Maximum-limit collage data failed: ' + error));
                } else {
                    resolve(result);
                }
            });
        });
        assert(maximum.species.length === 32 && maximum.omitted === 1, 'The configurable limit still caps the collage at 32 species.');
        assert(ids(maximum).join(',') === '2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33',
            'At the maximum limit, the oldest species is omitted.');
        var medium = { species: maximum.species.slice(0, 12) };
        view.show(medium, 'en');
        await waitForImages();
        checkRenderedCollage('en', medium.species);
        checkOrganicScatter(12);
        checkWrapperOverlap(12);

        view.show(maximum, 'de');
        await waitForImages();
        checkRenderedCollage('de', maximum.species);
        checkWrapperOverlap(32);

        var empty = await load([]);
        assert(empty.species.length === 0 && empty.omitted === 0, 'An empty day stays empty.');
        view.show(empty, 'en');
        assert(document.getElementById('collage').hidden, 'An empty day does not render a collage.');
        assert(!document.getElementById('latest-plate').hidden &&
            document.getElementById('collage-board').children.length === 0,
            'An empty day returns to the existing empty-perch painting.');
        if (keepPreview) {
            view.show(medium, 'en');
            await waitForImages();
            checkRenderedCollage('en', medium.species);
            checkOrganicScatter(12);
        }
    }

    run().then(function () {
        document.body.setAttribute('data-test-result', 'passed');
        output.textContent = 'PASS — ' + checks.length + ' collage behavior checks.\n' + checks.join('\n');
    }).catch(function (error) {
        document.body.setAttribute('data-test-result', 'failed');
        output.textContent = 'FAIL — ' + error.message + '\n' + checks.join('\n');
        if (window.console && window.console.error) {
            window.console.error(error);
        }
    });
}(window, document));
