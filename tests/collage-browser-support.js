(function (window) {
    'use strict';

    var species = {
        '1': {
            id: '1', commonName: 'European robin', scientificName: 'Erithacus rubecula',
            translations: [
                { locale: 'nl', commonName: 'Roodborst' },
                { locale: 'fr', commonName: 'Rougegorge familier' },
                { locale: 'de', commonName: 'Rotkehlchen' },
                { locale: 'es', commonName: 'Petirrojo europeo' },
                { locale: 'it', commonName: 'Pettirosso' },
                { locale: 'pt-BR', commonName: 'Pisco-de-peito-ruivo' }
            ]
        },
        '2': {
            id: '2', commonName: 'Common blackbird', scientificName: 'Turdus merula',
            translations: [
                { locale: 'nl', commonName: 'Merel' },
                { locale: 'fr', commonName: 'Merle noir' },
                { locale: 'de', commonName: 'Amsel' },
                { locale: 'es', commonName: 'Mirlo común' },
                { locale: 'it', commonName: 'Merlo' },
                { locale: 'pt-BR', commonName: 'Melro-preto' }
            ]
        },
        '3': {
            id: '3', commonName: 'Great tit', scientificName: 'Parus major',
            translations: [
                { locale: 'nl', commonName: 'Koolmees' },
                { locale: 'fr', commonName: 'Mésange charbonnière' },
                { locale: 'de', commonName: 'Kohlmeise' },
                { locale: 'es', commonName: 'Carbonero común' },
                { locale: 'it', commonName: 'Cinciallegra' },
                { locale: 'pt-BR', commonName: 'Chapim-real' }
            ]
        },
        '4': {
            id: '4', commonName: 'Blue tit', scientificName: 'Cyanistes caeruleus',
            translations: [
                { locale: 'nl', commonName: 'Pimpelmees' },
                { locale: 'fr', commonName: 'Mésange bleue' },
                { locale: 'de', commonName: 'Blaumeise' },
                { locale: 'es', commonName: 'Herrerillo común' },
                { locale: 'it', commonName: 'Cinciarella' },
                { locale: 'pt-BR', commonName: 'Chapim-azul' }
            ]
        },
        '5': {
            id: '5', commonName: 'Eurasian wren', scientificName: 'Troglodytes troglodytes',
            translations: [
                { locale: 'nl', commonName: 'Winterkoning' },
                { locale: 'fr', commonName: 'Troglodyte mignon' },
                { locale: 'de', commonName: 'Zaunkönig' },
                { locale: 'es', commonName: 'Chochín común' },
                { locale: 'it', commonName: 'Scricciolo' },
                { locale: 'pt-BR', commonName: 'Carricinha' }
            ]
        }
    };

    var imagePaths = {
        'Erithacus rubecula': 'birds/erithacus-rubecula.jpg',
        'Turdus merula': 'birds/turdus-merula.jpg',
        'Parus major': 'birds/parus-major.jpg',
        'Cyanistes caeruleus': 'birds/cyanistes-caeruleus.jpg',
        'Troglodytes troglodytes': 'birds/troglodytes-troglodytes.jpg'
    };

    for (var id = 6; id <= 33; id += 1) {
        var syntheticId = String(id);
        var scientificName = 'Avis testus ' + syntheticId;
        species[syntheticId] = {
            id: syntheticId,
            commonName: 'Test bird ' + syntheticId,
            scientificName: scientificName,
            translations: []
        };
        imagePaths[scientificName] = 'birds/troglodytes-troglodytes.jpg';
    }

    window.__collageTest = {
        now: Date.UTC(2026, 10, 7, 13, 0, 0),
        nodes: [],
        pages: null,
        queryCalls: [],
        species: species
    };

    window.Date.now = function () {
        return window.__collageTest.now;
    };

    window.BirdWeatherApi = {
        validStationId: function (value) {
            return typeof value === 'string' && /^[1-9][0-9]{0,17}$/.test(value);
        },
        collageStation: function (stationId, complete) {
            window.__collageTest.stationId = stationId;
            complete(null, { name: 'Test station', timezone: 'Europe/Amsterdam' });
            return { abort: function () {} };
        },
        nearbyStationIds: function (coordinates, radius, complete) {
            complete(null, ['7368']);
            return { abort: function () {} };
        },
        query: function (operation, variables, complete) {
            window.__collageTest.queryCalls.push({ operation: operation, variables: variables });
            complete(null, {
                detections: window.__collageTest.pages && window.__collageTest.pages.length ?
                    window.__collageTest.pages.shift() : {
                        nodes: window.__collageTest.nodes.slice(),
                        pageInfo: { hasNextPage: false, endCursor: null }
                    }
            });
            return { abort: function () {} };
        },
        speciesForIds: function (ids, complete) {
            complete(null, ids.map(function (id) { return species[id]; }));
            return { abort: function () {} };
        }
    };

    window.BirdWeatherArtwork = {
        paint: function (image, bird, complete) {
            var file = bird ? imagePaths[bird.scientificName] : null;
            image.setAttribute('src', file ? '../assets/plates/' + file : '../assets/field-sprig.svg');
            complete(file ? { species: bird.scientificName } : null);
        }
    };

}(window));
