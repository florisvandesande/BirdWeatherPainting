(function (window) {
    'use strict';

    var masses = null;
    var waiters = [];
    var loadState = 'idle';
    var medianMass = 180;
    var STEP = 10;
    var MAX_SHARE = 0.7;
    var ATTEMPTS = 12;
    var ALPHA_THRESHOLD = 0;

    function finishLoad() {
        loadState = 'ready';
        var waiting = waiters;
        waiters = [];
        waiting.forEach(function (callback) {
            callback(masses || Object.create(null));
        });
    }

    function load(callback) {
        if (loadState === 'ready') {
            callback(masses);
            return;
        }
        waiters.push(callback);
        if (loadState === 'loading') {
            return;
        }
        loadState = 'loading';
        masses = Object.create(null);
        var xhr = new XMLHttpRequest();
        var completed = false;
        xhr.timeout = 12000;

        function finish(body) {
            if (completed) {
                return;
            }
            completed = true;
            if (body && body.length < 1000000) {
                body.split(/\r?\n/).slice(1).forEach(function (line) {
                    var values = line.split(',');
                    var mass = Number(values[1]);
                    if (values.length === 2 && values[0] && isFinite(mass) && mass > 0 && mass < 200000) {
                        masses[values[0].toLowerCase()] = mass;
                    }
                });
            }
            var knownMasses = Object.keys(masses).map(function (name) {
                return masses[name];
            }).sort(function (first, second) {
                return first - second;
            });
            if (knownMasses.length) {
                medianMass = knownMasses[Math.floor(knownMasses.length / 2)];
            }
            finishLoad();
        }

        try {
            xhr.open('GET', 'assets/artwork/bird_sizes.csv', true);
            xhr.onreadystatechange = function () {
                if (xhr.readyState === 4) {
                    finish(xhr.status >= 200 && xhr.status < 300 ? xhr.responseText : null);
                }
            };
            xhr.onerror = xhr.ontimeout = function () {
                finish(null);
            };
            xhr.send(null);
        } catch (error) {
            finish(null);
        }
    }

    function hash(value) {
        var result = 2166136261;
        for (var index = 0; index < value.length; index += 1) {
            result = Math.imul ? Math.imul(result ^ value.charCodeAt(index), 16777619) :
                (result ^ value.charCodeAt(index)) * 16777619;
        }
        return result >>> 0;
    }

    function silhouette(image, width, height, mirrored) {
        var canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        var context = canvas.getContext('2d');
        var mask = new Uint8Array(width * height);
        if (!context || !image.naturalWidth || !image.naturalHeight) {
            for (var fallback = 0; fallback < mask.length; fallback += 1) {
                mask[fallback] = 1;
            }
            return mask;
        }

        try {
            if (mirrored) {
                context.translate(width, 0);
                context.scale(-1, 1);
            }
            context.drawImage(image, 0, 0, width, height);
            var pixels = context.getImageData(0, 0, width, height).data;
            for (var index = 0; index < mask.length; index += 1) {
                mask[index] = pixels[index * 4 + 3] > ALPHA_THRESHOLD ? 1 : 0;
            }
        } catch (error) {
            for (var safeFallback = 0; safeFallback < mask.length; safeFallback += 1) {
                mask[safeFallback] = 1;
            }
        }
        // Browser image resampling can give edge pixels alpha at fractional CSS positions.
        // A one-pixel safety rim keeps those rendered fringes from touching after scaling.
        var safeMask = new Uint8Array(mask.length);
        for (var y = 0; y < height; y += 1) {
            for (var x = 0; x < width; x += 1) {
                if (!mask[y * width + x]) {
                    continue;
                }
                for (var dy = -1; dy <= 1; dy += 1) {
                    for (var dx = -1; dx <= 1; dx += 1) {
                        var safeX = x + dx;
                        var safeY = y + dy;
                        if (safeX >= 0 && safeY >= 0 && safeX < width && safeY < height) {
                            safeMask[safeY * width + safeX] = 1;
                        }
                    }
                }
            }
        }
        return safeMask;
    }

    function prepare(entry, weight, scale, boardWidth, boardHeight, base) {
        var naturalWidth = entry.image.naturalWidth || 1;
        var naturalHeight = entry.image.naturalHeight || 1;
        var targetSize = Math.max(12, Math.round(base * scale * weight));
        var imageScale = targetSize / Math.max(naturalWidth, naturalHeight);
        var artWidth = Math.max(1, Math.round(naturalWidth * imageScale));
        var artHeight = Math.max(1, Math.round(naturalHeight * imageScale));
        var shortSide = Math.min(boardWidth, boardHeight);
        var fontSize = Math.max(7, Math.round(shortSide * 0.032 * scale));
        var caption = entry.caption;
        caption.style.display = 'block';
        caption.style.visibility = 'hidden';
        caption.style.position = 'absolute';
        caption.style.fontSize = fontSize + 'px';
        caption.style.lineHeight = '1.08';
        caption.style.height = 'auto';
        caption.style.left = '0';
        caption.style.top = '0';

        var measureCanvas = document.createElement('canvas');
        var measureContext = measureCanvas.getContext('2d');
        var commonName = entry.name.textContent;
        var scientificName = caption.lastChild.textContent;
        if (measureContext) {
            measureContext.font = fontSize + 'px ' + window.getComputedStyle(caption).fontFamily;
        }
        var textWidth = measureContext ? Math.max(
            measureContext.measureText(commonName).width,
            measureContext.measureText(scientificName).width
        ) : 0;
        var maxLabelWidth = Math.max(artWidth, Math.floor(boardWidth * 0.4));
        var labelWidth = Math.min(maxLabelWidth, Math.max(artWidth, Math.ceil(textWidth)));
        caption.style.width = labelWidth + 'px';
        var labelHeight = Math.max(fontSize * 2, Math.ceil(caption.scrollHeight));
        var mask = silhouette(entry.image, artWidth, artHeight, entry.mirrored);

        var columnTotal = 0;
        var columnCount = 0;
        for (var py = 0; py < artHeight; py += 1) {
            for (var px = 0; px < artWidth; px += 1) {
                if (mask[py * artWidth + px]) {
                    columnTotal += px;
                    columnCount += 1;
                }
            }
        }
        var center = columnCount ? Math.round(columnTotal / columnCount) : Math.round(artWidth / 2);
        var offset = Math.round(center - labelWidth / 2);
        var figureLeft = Math.min(0, offset);
        var imageLeft = -figureLeft;
        var labelLeft = offset - figureLeft;
        var underLeft = Math.max(0, labelLeft - imageLeft);
        var underRight = Math.min(artWidth, labelLeft - imageLeft + labelWidth);
        var lower = -1;
        for (var y = artHeight - 1; y >= 0 && lower < 0; y -= 1) {
            for (var x = underLeft; x < underRight; x += 1) {
                if (mask[y * artWidth + x]) {
                    lower = y;
                    break;
                }
            }
        }
        var labelTop = Math.max(0, lower + 1 + Math.round(fontSize * 0.35));
        entry.artWidth = artWidth;
        entry.artHeight = artHeight;
        entry.mask = mask;
        entry.labelWidth = labelWidth;
        entry.labelHeight = labelHeight;
        entry.imageLeft = imageLeft;
        entry.labelLeft = labelLeft;
        entry.labelTop = labelTop;
        entry.figureLeft = figureLeft;
        entry.figureWidth = Math.max(artWidth, labelLeft + labelWidth) - figureLeft;
        entry.figureHeight = Math.max(artHeight, labelTop + labelHeight);

        caption.style.left = labelLeft + 'px';
        caption.style.top = labelTop + 'px';
        caption.style.width = labelWidth + 'px';
        caption.style.height = labelHeight + 'px';
        entry.figure.style.width = entry.figureWidth + 'px';
        entry.figure.style.height = entry.figureHeight + 'px';
        entry.image.style.position = 'absolute';
        entry.image.style.left = imageLeft + 'px';
        entry.image.style.top = '0';
        entry.image.style.width = artWidth + 'px';
        entry.image.style.height = artHeight + 'px';
        entry.image.style.transform = entry.mirrored ? 'scaleX(-1)' : '';
        caption.style.visibility = '';
    }

    function collides(entry, x, y, occupied, width, height) {
        if (x < 0 || y < 0 || x + entry.figureWidth > width || y + entry.figureHeight > height) {
            return true;
        }
        for (var py = 0; py < entry.artHeight; py += 1) {
            var maskOffset = py * entry.artWidth;
            var boardOffset = (y + py) * width + x + entry.imageLeft;
            for (var px = 0; px < entry.artWidth; px += 1) {
                if (entry.mask[maskOffset + px] && occupied[boardOffset + px]) {
                    return true;
                }
            }
        }
        var left = x + entry.labelLeft;
        var top = y + entry.labelTop;
        for (var row = top; row < top + entry.labelHeight; row += 1) {
            for (var col = left; col < left + entry.labelWidth; col += 1) {
                if (occupied[row * width + col]) {
                    return true;
                }
            }
        }
        return false;
    }

    function placeMask(entry, x, y, occupied, width) {
        for (var py = 0; py < entry.artHeight; py += 1) {
            var maskOffset = py * entry.artWidth;
            var boardOffset = (y + py) * width + x + entry.imageLeft;
            for (var px = 0; px < entry.artWidth; px += 1) {
                if (entry.mask[maskOffset + px]) {
                    occupied[boardOffset + px] = 1;
                }
            }
        }
        var left = x + entry.labelLeft;
        var top = y + entry.labelTop;
        for (var row = top; row < top + entry.labelHeight; row += 1) {
            for (var col = left; col < left + entry.labelWidth; col += 1) {
                occupied[row * width + col] = 1;
            }
        }
    }

    function spiral(entry, occupied, width, height, seed) {
        var centerX = width / 2;
        var centerY = height / 2;
        var maxRadius = Math.sqrt(width * width + height * height);
        var phase = (hash(seed + '|' + entry.species.id) % 360) * Math.PI / 180;

        function candidate(pointX, pointY) {
            var x = Math.floor(pointX - entry.figureWidth / 2);
            var y = Math.floor(pointY - entry.figureHeight / 2);
            return collides(entry, x, y, occupied, width, height) ? null : [x, y];
        }

        var result = candidate(centerX, centerY);
        if (result) {
            return result;
        }
        for (var radius = STEP; radius <= maxRadius; radius += STEP) {
            var count = Math.max(8, Math.floor(2 * Math.PI * radius / STEP));
            for (var index = 0; index < count; index += 1) {
                var angle = phase + 2 * Math.PI * index / count;
                result = candidate(centerX + radius * Math.cos(angle), centerY + radius * Math.sin(angle));
                if (result) {
                    return result;
                }
            }
        }
        return null;
    }

    function centerPlacements(placements, width, height) {
        var minX = Math.min.apply(Math, placements.map(function (placement) { return placement.x; }));
        var minY = Math.min.apply(Math, placements.map(function (placement) { return placement.y; }));
        var maxX = Math.max.apply(Math, placements.map(function (placement) {
            return placement.x + placement.entry.figureWidth;
        }));
        var maxY = Math.max.apply(Math, placements.map(function (placement) {
            return placement.y + placement.entry.figureHeight;
        }));
        var offsetX = Math.floor((width - (maxX - minX)) / 2) - minX;
        var offsetY = Math.floor((height - (maxY - minY)) / 2) - minY;
        placements.forEach(function (placement) {
            placement.entry.figure.style.left = (placement.x + offsetX) + 'px';
            placement.entry.figure.style.top = (placement.y + offsetY) + 'px';
        });
    }

    function pack(entries, width, height, scale, weights, base, seed) {
        var occupied = new Uint8Array(width * height);
        var placements = [];
        entries.forEach(function (entry) {
            prepare(entry, weights[entry.layoutIndex], scale, width, height, base);
        });
        for (var index = 0; index < entries.length; index += 1) {
            var entry = entries[index];
            var spot = spiral(entry, occupied, width, height, seed);
            if (!spot) {
                return false;
            }
            placeMask(entry, spot[0], spot[1], occupied, width);
            placements.push({ entry: entry, x: spot[0], y: spot[1] });
        }
        centerPlacements(placements, width, height);
        return true;
    }

    function gridColumns(count, width, height) {
        var choices = [];
        for (var columns = 1; columns <= count; columns += 1) {
            var rows = Math.ceil(count / columns);
            var cellWidth = width / columns;
            var cellHeight = height / rows;
            choices.push({ columns: columns, rows: rows, score: Math.abs(Math.log(cellWidth / cellHeight)) });
        }
        choices.sort(function (first, second) {
            return first.score - second.score || first.columns - second.columns;
        });
        return choices;
    }

    function gridFallback(entries, width, height, weights, base) {
        var choices = gridColumns(entries.length, width, height);
        for (var choiceIndex = 0; choiceIndex < choices.length; choiceIndex += 1) {
            var choice = choices[choiceIndex];
            var cellWidth = width / choice.columns;
            var cellHeight = height / choice.rows;
            for (var attempt = 0; attempt < 32; attempt += 1) {
                var scale = Math.pow(0.85, attempt);
                entries.forEach(function (entry) {
                    prepare(entry, weights[entry.layoutIndex], scale, width, height, base);
                });
                var fits = entries.every(function (entry) {
                    return entry.figureWidth <= cellWidth && entry.figureHeight <= cellHeight;
                });
                if (!fits) {
                    continue;
                }
                for (var index = 0; index < entries.length; index += 1) {
                    var row = Math.floor(index / choice.columns);
                    var column = index % choice.columns;
                    var rowCount = Math.min(choice.columns, entries.length - row * choice.columns);
                    var rowOffset = Math.floor((width - rowCount * cellWidth) / 2);
                    var x = rowOffset + column * cellWidth + (cellWidth - entries[index].figureWidth) / 2;
                    var y = row * cellHeight + (cellHeight - entries[index].figureHeight) / 2;
                    entries[index].figure.style.left = Math.floor(x) + 'px';
                    entries[index].figure.style.top = Math.floor(y) + 'px';
                }
                return true;
            }
        }
        return false;
    }

    function arrange(entries, board, callback) {
        if (!entries || entries.length < 1 || entries.length > 32) {
            callback(false);
            return;
        }
        load(function (massData) {
            var totalLogMass = 0;
            entries.forEach(function (entry) {
                entry.mirrored = (hash(entry.species.scientificName) & 1) === 1;
                entry.mass = massData[entry.species.scientificName.toLowerCase()] || medianMass;
                totalLogMass += Math.log(entry.mass);
            });
            var geometricMeanMass = Math.exp(totalLogMass / entries.length);
            var weights = entries.map(function (entry) {
                return Math.pow(entry.mass / geometricMeanMass, 0.14);
            });
            entries.forEach(function (entry, index) {
                entry.layoutIndex = index;
            });
            entries.sort(function (first, second) {
                return weights[second.layoutIndex] - weights[first.layoutIndex] ||
                    (first.species.scientificName < second.species.scientificName ? -1 : 1);
            });

            var width = Math.max(1, Math.floor(board.clientWidth));
            var height = Math.max(1, Math.floor(board.clientHeight));
            var shortSide = Math.min(width, height);
            var squares = weights.reduce(function (sum, weight) {
                return sum + weight * weight;
            }, 0);
            var largestWeight = Math.max.apply(Math, weights);
            var base = Math.min(
                Math.sqrt(width * height * 1.5 / squares),
                shortSide * MAX_SHARE / largestWeight
            );
            var seed = entries.map(function (entry) { return entry.species.id; }).sort().join('|');

            for (var attempt = 0; attempt < ATTEMPTS; attempt += 1) {
                if (pack(entries, width, height, Math.pow(0.9, attempt), weights, base, seed)) {
                    callback(true);
                    return;
                }
            }
            callback(gridFallback(entries, width, height, weights, base));
        });
    }

    window.BirdWeatherCollageLayout = { arrange: arrange };
}(window));
