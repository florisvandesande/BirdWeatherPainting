(function (window) {
    'use strict';

    var geometry = null;
    var masses = null;
    var waiters = [];
    var loadState = 'idle';
    var cellSize = 6;

    function finishLoad() {
        if (!geometry || !masses) {
            return;
        }
        loadState = 'ready';
        var waiting = waiters;
        waiters = [];
        waiting.forEach(function (callback) { callback(geometry, masses); });
    }

    function load(callback) {
        if (loadState === 'ready') {
            callback(geometry, masses);
            return;
        }
        waiters.push(callback);
        if (loadState === 'loading') {
            return;
        }
        loadState = 'loading';

        function request(path, complete) {
            var xhr = new XMLHttpRequest();
            var completed = false;
            function finish(body) {
                if (completed) {
                    return;
                }
                completed = true;
                complete(body);
            }
            xhr.timeout = 12000;
            try {
                xhr.open('GET', path, true);
                xhr.onreadystatechange = function () {
                    if (xhr.readyState !== 4) {
                        return;
                    }
                    try {
                        finish(xhr.status >= 200 && xhr.status < 300 ? xhr.responseText : null);
                    } catch (error) {
                        finish(null);
                    }
                };
                xhr.onerror = xhr.ontimeout = function () { finish(null); };
                xhr.send(null);
            } catch (error) {
                finish(null);
            }
        }

        var remaining = 2;
        function done() {
            remaining -= 1;
            if (!remaining) {
                finishLoad();
            }
        }
        request('assets/artwork/geometry.json', function (body) {
            if (body && body.length < 20000000) {
                try { geometry = JSON.parse(body); } catch (error) { geometry = {}; }
            }
            geometry = geometry || {};
            done();
        });
        request('assets/artwork/bird_sizes.csv', function (body) {
            masses = Object.create(null);
            if (body && body.length < 1000000) {
                body.split(/\r?\n/).slice(1).forEach(function (line) {
                    var values = line.split(',');
                    var mass = Number(values[1]);
                    if (values.length === 2 && values[0] && isFinite(mass) && mass > 0 && mass < 200000) {
                        masses[values[0].toLowerCase()] = mass;
                    }
                });
            }
            done();
        });
    }

    function hash(value) {
        var result = 2166136261;
        for (var index = 0; index < value.length; index += 1) {
            result = (result ^ value.charCodeAt(index)) * 16777619;
        }
        return result >>> 0;
    }

    function imageGeometry(image) {
        var path = image.getAttribute('src') || '';
        var name = path.split('/').pop().replace(/\.png(?:\?.*)?$/i, '.webp');
        if (!name || name === path.split('/').pop()) {
            return [0, 0, 1, 1];
        }
        var data = geometry['birds/' + name];
        return data && data.box && data.box.length === 4 ? data.box : [0, 0, 1, 1];
    }

    function alphaMask(image, width, height, box) {
        var canvas = document.createElement('canvas');
        var context;
        var edge = 40;
        canvas.width = edge;
        canvas.height = edge;
        context = canvas.getContext('2d');
        if (!context || !image.naturalWidth || !image.naturalHeight) {
            var solid = new Uint8Array(edge * edge);
            for (var solidIndex = 0; solidIndex < solid.length; solidIndex += 1) { solid[solidIndex] = 1; }
            return { width: edge, height: edge, data: solid };
        }
        try {
            context.drawImage(image, 0, 0, edge, edge);
            var pixels = context.getImageData(0, 0, edge, edge).data;
            var mask = new Uint8Array(edge * edge);
            var left = Math.floor(box[0] * edge);
            var top = Math.floor(box[1] * edge);
            var right = Math.ceil(box[2] * edge);
            var bottom = Math.ceil(box[3] * edge);
            for (var y = top; y < bottom; y += 1) {
                for (var x = left; x < right; x += 1) {
                    mask[y * edge + x] = pixels[(y * edge + x) * 4 + 3] > 24 ? 1 : 0;
                }
            }
            return { width: edge, height: edge, data: mask };
        } catch (error) {
            var fallback = new Uint8Array(edge * edge);
            for (var fallbackIndex = 0; fallbackIndex < fallback.length; fallbackIndex += 1) { fallback[fallbackIndex] = 1; }
            return { width: edge, height: edge, data: fallback };
        }
    }

    function occupiedAt(mask, x, y, width, height, occupancy, labels) {
        var cols = Math.ceil(width / cellSize);
        var rows = Math.ceil(height / cellSize);
        var left = Math.round(x / cellSize);
        var top = Math.round(y / cellSize);
        var boardColumns = Math.ceil(width / cellSize);
        var boardRows = Math.ceil(height / cellSize);
        if (left < 0 || top < 0 || left + cols > boardColumns || top + rows > boardRows) {
            return true;
        }
        for (var py = 0; py < mask.height; py += 1) {
            for (var px = 0; px < mask.width; px += 1) {
                if (!mask.data[py * mask.width + px]) {
                    continue;
                }
                var cx = left + Math.floor(px * cols / mask.width);
                var cy = top + Math.floor(py * rows / mask.height);
                if (occupancy[cy * Math.ceil(width / cellSize) + cx] || labels[cy * Math.ceil(width / cellSize) + cx]) {
                    return true;
                }
            }
        }
        return false;
    }

    function place(entries, board, scale) {
        var width = Math.max(1, Math.floor(board.clientWidth));
        var height = Math.max(1, Math.floor(board.clientHeight));
        var columns = Math.ceil(width / cellSize);
        var occupancy = new Uint8Array(columns * Math.ceil(height / cellSize));
        var labels = new Uint8Array(occupancy.length);
        var maxMass = Math.max.apply(Math, entries.map(function (entry) { return entry.mass; }));
        var sizeFactor = entries.length === 1 ? 0.64 : entries.length <= 3 ? 0.48 :
            entries.length <= 8 ? 0.38 : 0.3;
        var gap = Math.max(2, Math.round(Math.min(width, height) * 0.006));

        entries.forEach(function (entry) {
            var relative = Math.max(0.4, Math.min(1, Math.pow(entry.mass / maxMass, 0.28)));
            entry.width = Math.max(24, Math.round(Math.min(width, height) * sizeFactor * relative * scale));
            var aspect = entry.image.naturalWidth && entry.image.naturalHeight ?
                entry.image.naturalHeight / entry.image.naturalWidth : 0.72;
            entry.height = Math.round(entry.width * aspect);
            entry.caption.style.fontSize = Math.max(9, Math.min(16, entry.width * 0.115 * scale)) + 'px';
            entry.figure.style.width = entry.width + 'px';
            entry.image.style.height = entry.height + 'px';
            entry.caption.style.display = 'block';
            entry.caption.style.visibility = 'hidden';
            entry.caption.style.position = 'absolute';
            var longestLine = Math.max(entry.name.textContent.length, entry.caption.lastChild.textContent.length);
            entry.labelWidth = Math.min(Math.floor(width * 0.44), Math.max(entry.width,
                Math.ceil(longestLine * parseFloat(entry.caption.style.fontSize) * 0.52)));
            entry.caption.style.left = Math.round((entry.width - entry.labelWidth) / 2) + 'px';
            entry.caption.style.top = entry.height + 'px';
            entry.caption.style.width = entry.labelWidth + 'px';
            entry.caption.style.height = 'auto';
            entry.labelHeight = Math.max(22, Math.ceil(entry.caption.scrollHeight));
            entry.box = imageGeometry(entry.image);
            entry.mask = alphaMask(entry.image, entry.width, entry.height, entry.box);
        });

        entries.sort(function (a, b) { return b.mass - a.mass || (a.species.scientificName < b.species.scientificName ? -1 : 1); });
        var centerX = width / 2;
        var centerY = height / 2;
        for (var index = 0; index < entries.length; index += 1) {
            var entry = entries[index];
            var angleOffset = (hash(entry.species.scientificName) % 360) * Math.PI / 180;
            var candidates = [];
            for (var step = 0; step < 1000; step += 1) {
                var angle = step * 2.399963229728653 + angleOffset;
                var radius = Math.sqrt(step) * Math.min(width, height) * 0.025;
                candidates.push([centerX + Math.cos(angle) * radius - entry.width / 2,
                    centerY + Math.sin(angle) * radius - (entry.height + entry.labelHeight) / 2]);
            }
            var placed = false;
            for (var candidate = 0; candidate < candidates.length; candidate += 1) {
                var x = candidates[candidate][0];
                var y = candidates[candidate][1];
                if (occupiedAt(entry.mask, x, y, width, height, occupancy, labels)) {
                    continue;
                }
                var left = Math.round(x / cellSize);
                var top = Math.round(y / cellSize);
                var cols = Math.ceil(entry.width / cellSize);
                var rows = Math.ceil(entry.height / cellSize);
                var labelRows = Math.ceil((entry.labelHeight + gap) / cellSize);
                var labelColumns = Math.ceil(entry.labelWidth / cellSize);
                var labelLeft = Math.round((x + (entry.width - entry.labelWidth) / 2) / cellSize);
                if (top + rows + labelRows > Math.ceil(height / cellSize) || labelLeft < 0 ||
                        labelLeft + labelColumns > columns) {
                    continue;
                }
                var labelFits = true;
                for (var ly = top + rows; ly < top + rows + labelRows && labelFits; ly += 1) {
                    for (var lx = labelLeft; lx < labelLeft + labelColumns; lx += 1) {
                        var cell = ly * columns + lx;
                        if (labels[cell] || occupancy[cell]) {
                            labelFits = false;
                            break;
                        }
                    }
                }
                if (!labelFits) {
                    continue;
                }
                for (var py = 0; py < entry.mask.height; py += 1) {
                    for (var px = 0; px < entry.mask.width; px += 1) {
                        if (entry.mask.data[py * entry.mask.width + px]) {
                            var cellX = left + Math.floor(px * cols / entry.mask.width);
                            var cellY = top + Math.floor(py * rows / entry.mask.height);
                            occupancy[cellY * columns + cellX] = 1;
                        }
                    }
                }
                for (var labelY = top + rows; labelY < top + rows + labelRows; labelY += 1) {
                    for (var labelX = labelLeft; labelX < labelLeft + labelColumns; labelX += 1) {
                        labels[labelY * columns + labelX] = 1;
                    }
                }
                entry.figure.style.left = Math.round(x) + 'px';
                entry.figure.style.top = Math.round(y) + 'px';
                entry.figure.style.width = entry.width + 'px';
                entry.figure.style.height = (entry.height + entry.labelHeight + gap) + 'px';
                entry.caption.style.visibility = 'visible';
                entry.caption.style.position = 'relative';
                entry.caption.style.top = 'auto';
                entry.caption.style.height = entry.labelHeight + 'px';
                entry.placed = true;
                placed = true;
                break;
            }
            if (!placed) {
                return false;
            }
        }
        return true;
    }

    function arrange(entries, board, callback) {
        load(function (geometryData, massData) {
            entries.forEach(function (entry) {
                entry.mass = massData[entry.species.scientificName.toLowerCase()] || 180;
            });
            entries.sort(function (a, b) { return b.mass - a.mass; });
            var scale = 1.3;
            while (scale >= 0.16) {
                if (place(entries, board, scale)) {
                    callback(true);
                    return;
                }
                entries.forEach(function (entry) { entry.placed = false; });
                scale -= 0.04;
            }
            callback(false);
        });
    }

    window.BirdWeatherCollageLayout = { arrange: arrange };
}(window));
