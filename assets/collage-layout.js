(function (window) {
    'use strict';
    var geometry = null, masses = null, waiters = [], loadState = 'idle', medianMass = 180;
    var STEP = 6, ALPHA = 24, EROSION = 2, MAX_SHARE = 0.7, ATTEMPTS = 20;

    function finishLoad() {
        if (!geometry || !masses) { return; }
        loadState = 'ready';
        var waiting = waiters; waiters = [];
        waiting.forEach(function (callback) { callback(geometry, masses); });
    }
    function load(callback) {
        if (loadState === 'ready') { callback(geometry, masses); return; }
        waiters.push(callback);
        if (loadState === 'loading') { return; }
        loadState = 'loading';
        function request(path, complete) {
            var xhr = new XMLHttpRequest(), completed = false;
            function finish(body) { if (!completed) { completed = true; complete(body); } }
            xhr.timeout = 12000;
            try {
                xhr.open('GET', path, true);
                xhr.onreadystatechange = function () {
                    if (xhr.readyState !== 4) { return; }
                    try { finish(xhr.status >= 200 && xhr.status < 300 ? xhr.responseText : null); }
                    catch (error) { finish(null); }
                };
                xhr.onerror = xhr.ontimeout = function () { finish(null); };
                xhr.send(null);
            } catch (error) { finish(null); }
        }
        var remaining = 2;
        function done() { remaining -= 1; if (!remaining) { finishLoad(); } }
        request('assets/artwork/geometry.json', function (body) {
            if (body && body.length < 20000000) { try { geometry = JSON.parse(body); } catch (error) { geometry = {}; } }
            geometry = geometry || {}; done();
        });
        request('assets/artwork/bird_sizes.csv', function (body) {
            masses = Object.create(null);
            if (body && body.length < 1000000) {
                body.split(/\r?\n/).slice(1).forEach(function (line) {
                    var values = line.split(','), mass = Number(values[1]);
                    if (values.length === 2 && values[0] && isFinite(mass) && mass > 0 && mass < 200000) {
                        masses[values[0].toLowerCase()] = mass;
                    }
                });
            }
            var knownMasses = Object.keys(masses).map(function (name) { return masses[name]; }).sort(function (a, b) { return a - b; });
            if (knownMasses.length) { medianMass = knownMasses[Math.floor(knownMasses.length / 2)]; }
            done();
        });
    }
    function hash(value) {
        var result = 2166136261;
        for (var i = 0; i < value.length; i += 1) {
            result = Math.imul ? Math.imul(result ^ value.charCodeAt(i), 16777619) : (result ^ value.charCodeAt(i)) * 16777619;
        }
        return result >>> 0;
    }
    function imageGeometry(image) {
        var path = image.getAttribute('src') || '', filename = path.split('/').pop();
        var name = filename.replace(/\.png(?:\?.*)?$/i, '.webp'), data = geometry['birds/' + name];
        return data && data.box && data.box.length === 4 ? data.box : [0, 0, 1, 1];
    }
    function silhouette(image, width, height, box, mirrored) {
        var canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        var context = canvas.getContext('2d'), source = new Uint8Array(width * height);
        if (!context || !image.naturalWidth || !image.naturalHeight) {
            for (var fallback = 0; fallback < source.length; fallback += 1) { source[fallback] = 1; }
            return source;
        }
        try {
            context.drawImage(image, 0, 0, width, height);
            var pixels = context.getImageData(0, 0, width, height).data;
            for (var y = 0; y < height; y += 1) {
                for (var x = 0; x < width; x += 1) {
                    var sx = mirrored ? width - x - 1 : x;
                    source[y * width + x] = pixels[(y * width + sx) * 4 + 3] > ALPHA ? 1 : 0;
                }
            }
            var eroded = new Uint8Array(source.length), any = false;
            for (y = EROSION; y < height - EROSION; y += 1) {
                for (x = EROSION; x < width - EROSION; x += 1) {
                    var keep = 1;
                    for (var dy = -EROSION; dy <= EROSION && keep; dy += 1) {
                        for (var dx = -EROSION; dx <= EROSION; dx += 1) {
                            if (!source[(y + dy) * width + x + dx]) { keep = 0; break; }
                        }
                    }
                    if (keep) { eroded[y * width + x] = 1; any = true; }
                }
            }
            return any ? eroded : source;
        } catch (error) {
            for (var fallbackIndex = 0; fallbackIndex < source.length; fallbackIndex += 1) { source[fallbackIndex] = 1; }
            return source;
        }
    }
    function prepare(entry, weight, scale, boardWidth, boardHeight, base) {
        var box = entry.box, nw = entry.image.naturalWidth || 1, nh = entry.image.naturalHeight || 1;
        var span = Math.max((box[2] - box[0]) * nw, (box[3] - box[1]) * nh);
        var ratio = span > 0 ? Math.max(nw, nh) / span : 1;
        var dim = Math.max(24, Math.round(base * scale * weight));
        var artWidth = Math.max(1, Math.round(dim * nw / Math.max(nw, nh)));
        var artHeight = Math.max(1, Math.round(dim * nh / Math.max(nw, nh)));
        var shortSide = Math.min(boardWidth, boardHeight), fontSize = Math.max(11, Math.round(shortSide * 0.032 * scale));
        var caption = entry.caption;
        caption.style.display = 'block'; caption.style.visibility = 'hidden'; caption.style.position = 'absolute';
        caption.style.fontSize = fontSize + 'px'; caption.style.lineHeight = '1.08';
        var maxLabelWidth = Math.max(artWidth, Math.floor(boardWidth * 0.4));
        caption.style.width = 'auto';
        caption.style.height = 'auto'; caption.style.left = '0'; caption.style.top = '0';
        var measureCanvas = document.createElement('canvas');
        var measureContext = measureCanvas.getContext('2d');
        var commonName = entry.name.textContent;
        var scientificName = caption.lastChild.textContent;
        if (measureContext) { measureContext.font = fontSize + 'px ' + window.getComputedStyle(caption).fontFamily; }
        var textWidth = measureContext ? Math.max(measureContext.measureText(commonName).width,
            measureContext.measureText(scientificName).width) : 0;
        var labelWidth = Math.min(maxLabelWidth, Math.max(artWidth, Math.ceil(textWidth)));
        caption.style.width = labelWidth + 'px';
        var labelHeight = Math.max(fontSize * 2, Math.ceil(caption.scrollHeight));
        var mask = silhouette(entry.image, artWidth, artHeight, box, entry.mirrored);
        var columnTotal = 0, columnCount = 0;
        for (var py = 0; py < artHeight; py += 1) {
            for (var px = 0; px < artWidth; px += 1) {
                if (mask[py * artWidth + px]) { columnTotal += px; columnCount += 1; }
            }
        }
        var center = columnCount ? Math.round(columnTotal / columnCount) : Math.round(artWidth / 2);
        var offset = Math.round(center - labelWidth / 2), figureLeft = Math.min(0, offset);
        var imageLeft = -figureLeft, labelLeft = offset - figureLeft;
        var underLeft = Math.max(0, labelLeft - imageLeft), underRight = Math.min(artWidth, labelLeft - imageLeft + labelWidth);
        var lower = -1;
        for (var y = artHeight - 1; y >= 0 && lower < 0; y -= 1) {
            for (var x = underLeft; x < underRight; x += 1) { if (mask[y * artWidth + x]) { lower = y; break; } }
        }
        var labelTop = Math.max(0, lower + 1 + Math.round(fontSize * 0.35));
        entry.artWidth = artWidth; entry.artHeight = artHeight; entry.mask = mask;
        entry.labelWidth = labelWidth; entry.labelHeight = labelHeight; entry.imageLeft = imageLeft;
        entry.labelLeft = labelLeft; entry.labelTop = labelTop; entry.figureLeft = figureLeft;
        entry.figureWidth = Math.max(artWidth, labelLeft + labelWidth) - figureLeft;
        entry.figureHeight = Math.max(artHeight, labelTop + labelHeight);
        caption.style.left = labelLeft + 'px'; caption.style.top = labelTop + 'px';
        caption.style.width = labelWidth + 'px'; caption.style.height = labelHeight + 'px';
        entry.figure.style.width = entry.figureWidth + 'px'; entry.figure.style.height = entry.figureHeight + 'px';
        entry.image.style.position = 'absolute'; entry.image.style.left = imageLeft + 'px'; entry.image.style.top = '0';
        entry.image.style.width = artWidth + 'px'; entry.image.style.height = artHeight + 'px';
        entry.image.style.transform = entry.mirrored ? 'scaleX(-1)' : '';
        caption.style.visibility = 'visible';
    }
    function collides(entry, x, y, occupied, width, height) {
        if (x < 0 || y < 0 || x + entry.figureWidth > width || y + entry.figureHeight > height) { return true; }
        for (var py = 0; py < entry.artHeight; py += 1) {
            var maskOffset = py * entry.artWidth, boardOffset = (y + py) * width + x + entry.imageLeft;
            for (var px = 0; px < entry.artWidth; px += 1) {
                if (entry.mask[maskOffset + px] && occupied[boardOffset + px]) { return true; }
            }
        }
        var lx = x + entry.labelLeft, ly = y + entry.labelTop;
        for (var row = ly; row < ly + entry.labelHeight; row += 1) {
            for (var col = lx; col < lx + entry.labelWidth; col += 1) { if (occupied[row * width + col]) { return true; } }
        }
        return false;
    }
    function placeMask(entry, x, y, occupied, width) {
        for (var py = 0; py < entry.artHeight; py += 1) {
            var maskOffset = py * entry.artWidth, boardOffset = (y + py) * width + x + entry.imageLeft;
            for (var px = 0; px < entry.artWidth; px += 1) {
                if (entry.mask[maskOffset + px]) { occupied[boardOffset + px] = 1; }
            }
        }
        var lx = x + entry.labelLeft, ly = y + entry.labelTop;
        for (var row = ly; row < ly + entry.labelHeight; row += 1) {
            for (var col = lx; col < lx + entry.labelWidth; col += 1) { occupied[row * width + col] = 1; }
        }
    }
    function spiral(entry, occupied, width, height) {
        var cx = width / 2, cy = height / 2, maxR = Math.sqrt(width * width + height * height);
        function candidate(px, py) {
            var x = Math.floor(px - entry.figureWidth / 2), y = Math.floor(py - entry.figureHeight / 2);
            return collides(entry, x, y, occupied, width, height) ? null : [x, y];
        }
        var result = candidate(cx, cy); if (result) { return result; }
        for (var r = STEP; r <= maxR; r += STEP) {
            var count = Math.max(8, Math.floor(2 * Math.PI * r / STEP));
            for (var i = 0; i < count; i += 1) {
                var a = 2 * Math.PI * i / count;
                result = candidate(cx + r * Math.cos(a), cy + r * Math.sin(a));
                if (result) { return result; }
            }
        }
        return null;
    }
    function pack(entries, board, scale, weights, base) {
        var width = Math.max(1, Math.floor(board.clientWidth)), height = Math.max(1, Math.floor(board.clientHeight));
        var occupied = new Uint8Array(width * height), placements = [];
        entries.forEach(function (entry) { prepare(entry, weights[entry.layoutIndex], scale, width, height, base); });
        for (var i = 0; i < entries.length; i += 1) {
            var entry = entries[i], spot = spiral(entry, occupied, width, height);
            if (!spot) { return false; }
            placeMask(entry, spot[0], spot[1], occupied, width);
            placements.push({ entry: entry, x: spot[0] + entry.figureLeft, y: spot[1] });
        }
        var minX = Math.min.apply(Math, placements.map(function (p) { return p.x; }));
        var minY = Math.min.apply(Math, placements.map(function (p) { return p.y; }));
        var maxX = Math.max.apply(Math, placements.map(function (p) { return p.x + p.entry.figureWidth; }));
        var maxY = Math.max.apply(Math, placements.map(function (p) { return p.y + p.entry.figureHeight; }));
        var dx = Math.floor((width - (maxX - minX)) / 2) - minX;
        var dy = Math.floor((height - (maxY - minY)) / 2) - minY;
        placements.forEach(function (p) { p.entry.figure.style.left = (p.x + dx) + 'px'; p.entry.figure.style.top = (p.y + dy) + 'px'; });
        return true;
    }
    function arrange(entries, board, callback) {
        if (!entries || entries.length < 1 || entries.length > 32) { callback(false); return; }
        load(function (geometryData, massData) {
            var logMass = 0;
            entries.forEach(function (entry) {
                entry.mirrored = (hash(entry.species.scientificName) & 1) === 1;
                entry.mass = massData[entry.species.scientificName.toLowerCase()] || medianMass;
                logMass += Math.log(entry.mass); entry.box = imageGeometry(entry.image);
            });
            var geoMean = Math.exp(logMass / entries.length);
            var weights = entries.map(function (entry) {
                var nw = entry.image.naturalWidth || 1, nh = entry.image.naturalHeight || 1, b = entry.box;
                var span = Math.max((b[2] - b[0]) * nw, (b[3] - b[1]) * nh);
                var ratio = span > 0 ? Math.max(nw, nh) / span : 1;
                return Math.pow(entry.mass / geoMean, 0.14) * ratio;
            });
            entries.forEach(function (entry, index) { entry.layoutIndex = index; });
            entries.sort(function (a, b) { return weights[b.layoutIndex] - weights[a.layoutIndex] || (a.species.scientificName < b.species.scientificName ? -1 : 1); });
            var width = Math.max(1, Math.floor(board.clientWidth)), height = Math.max(1, Math.floor(board.clientHeight));
            var short = Math.min(width, height), squares = weights.reduce(function (sum, w) { return sum + w * w; }, 0);
            var base = Math.min(Math.sqrt(width * height * 1.5 / squares), short * MAX_SHARE / Math.max.apply(Math, weights));
            for (var attempt = 0; attempt < ATTEMPTS; attempt += 1) {
                if (pack(entries, board, Math.pow(0.9, attempt), weights, base)) { callback(true); return; }
            }
            callback(false);
        });
    }
    window.BirdWeatherCollageLayout = { arrange: arrange };
}(window));
