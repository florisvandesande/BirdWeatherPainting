import CoreGraphics
import Foundation
import ImageIO

let licenseName = "CC BY-SA 4.0"
let licenseURL = "https://creativecommons.org/licenses/by-sa/4.0/"
let attributionURL = "https://github.com/arnegiacomo/fugleramme/blob/main/assets/artwork/classic/ATTRIBUTION.md"
let paperHex = "#f0ece6"
let maxImageEdge = 600.0
let jpegQuality = 0.68
let previewInputs = [
    "birds/turdus-merula.webp",
    "birds/cyanistes-caeruleus.webp",
    "birds/saxicola-rubicola.webp",
    "perches/pine-bough.webp"
]
let maximumFringeDepth: UInt8 = 12

typealias JSONObject = [String: Any]

func stop(_ message: String) -> Never {
    fputs("Error: \(message)\n", stderr)
    exit(1)
}

func normalize(_ name: String) -> String {
    return name.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        .replacingOccurrences(of: "_", with: " ")
        .replacingOccurrences(of: "-", with: " ")
        .split(whereSeparator: { $0.isWhitespace }).joined(separator: " ")
}

func speciesName(for file: String) -> String {
    var stem = URL(fileURLWithPath: file).deletingPathExtension().lastPathComponent
    if let range = stem.range(of: #"-[2-9][0-9]*$"#, options: .regularExpression) {
        stem.removeSubrange(range)
    }
    let words = stem.replacingOccurrences(of: "-", with: " ").split(separator: " ")
    guard !words.isEmpty else { return stem }
    return ([words[0].capitalized] + words.dropFirst().map(String.init)).joined(separator: " ")
}

func paperColor() -> (red: Int, green: Int, blue: Int) {
    return (240, 236, 230)
}

func colorVariation(_ pixels: UnsafePointer<UInt8>, width: Int, height: Int, x: Int, y: Int) -> Int {
    var minimumRed = 255
    var minimumGreen = 255
    var minimumBlue = 255
    var maximumRed = 0
    var maximumGreen = 0
    var maximumBlue = 0

    for offsetY in -1...1 {
        let sampleY = y + offsetY
        guard sampleY >= 0 && sampleY < height else { continue }
        for offsetX in -1...1 {
            let sampleX = x + offsetX
            guard sampleX >= 0 && sampleX < width else { continue }
            let index = (sampleY * width + sampleX) * 4
            let alpha = Int(pixels[index + 3])
            guard alpha >= 96 else { continue }

            let red = min(255, Int(pixels[index]) * 255 / alpha)
            let green = min(255, Int(pixels[index + 1]) * 255 / alpha)
            let blue = min(255, Int(pixels[index + 2]) * 255 / alpha)
            minimumRed = min(minimumRed, red)
            minimumGreen = min(minimumGreen, green)
            minimumBlue = min(minimumBlue, blue)
            maximumRed = max(maximumRed, red)
            maximumGreen = max(maximumGreen, green)
            maximumBlue = max(maximumBlue, blue)
        }
    }

    return max(maximumRed - minimumRed, max(maximumGreen - minimumGreen, maximumBlue - minimumBlue))
}

func paleMatteCandidate(red: Int, green: Int, blue: Int) -> Bool {
    let channelRange = max(red, max(green, blue)) - min(red, min(green, blue))
    let distanceFromPaper = abs(red - 240) + abs(green - 236) + abs(blue - 230)
    return red >= 190 && green >= 175 && blue >= 160 &&
        channelRange <= 65 && distanceFromPaper <= 95
}

func reducePaleFringe(_ pixels: UnsafeMutablePointer<UInt8>, alphaMask: UnsafePointer<UInt8>, width: Int, height: Int) {
    let count = width * height
    let distanceCap = maximumFringeDepth + 1
    var distance = [UInt8](repeating: distanceCap, count: count)

    for index in 0..<count where alphaMask[index * 4 + 3] <= 64 {
        distance[index] = 0
    }

    for y in 0..<height {
        for x in 0..<width {
            let index = y * width + x
            var nearest = distance[index]
            if x > 0 { nearest = min(nearest, distance[index - 1] + 1) }
            if y > 0 { nearest = min(nearest, distance[index - width] + 1) }
            if x > 0 && y > 0 { nearest = min(nearest, distance[index - width - 1] + 1) }
            if x + 1 < width && y > 0 { nearest = min(nearest, distance[index - width + 1] + 1) }
            distance[index] = min(nearest, distanceCap)
        }
    }

    for y in stride(from: height - 1, through: 0, by: -1) {
        for x in stride(from: width - 1, through: 0, by: -1) {
            let index = y * width + x
            var nearest = distance[index]
            if x + 1 < width { nearest = min(nearest, distance[index + 1] + 1) }
            if y + 1 < height { nearest = min(nearest, distance[index + width] + 1) }
            if x + 1 < width && y + 1 < height { nearest = min(nearest, distance[index + width + 1] + 1) }
            if x > 0 && y + 1 < height { nearest = min(nearest, distance[index + width - 1] + 1) }
            distance[index] = min(nearest, distanceCap)
        }
    }

    let paper = paperColor()
    for y in 0..<height {
        for x in 0..<width {
            let index = y * width + x
            let alpha = Int(alphaMask[index * 4 + 3])
            let edgeDistance = distance[index]
            guard alpha >= 96 && edgeDistance > 0 && edgeDistance <= maximumFringeDepth else { continue }

            let red = Int(pixels[index * 4])
            let green = Int(pixels[index * 4 + 1])
            let blue = Int(pixels[index * 4 + 2])
            guard paleMatteCandidate(red: red, green: green, blue: blue) else { continue }

            // The outer rim is pale and locally smooth; strong nearby variation protects feathers and twigs.
            let variation = colorVariation(UnsafePointer(pixels), width: width, height: height, x: x, y: y)
            let localSmoothness = max(0.25, 1.0 - Double(variation) / 140.0)
            let inwardStrength = 0.8 + 0.2 * Double(edgeDistance) / Double(maximumFringeDepth)
            let paperBlend = 0.82 * localSmoothness * inwardStrength

            let correctedRed = Int((Double(red) + (Double(paper.red) - Double(red)) * paperBlend).rounded())
            let correctedGreen = Int((Double(green) + (Double(paper.green) - Double(green)) * paperBlend).rounded())
            let correctedBlue = Int((Double(blue) + (Double(paper.blue) - Double(blue)) * paperBlend).rounded())
            pixels[index * 4] = UInt8(correctedRed)
            pixels[index * 4 + 1] = UInt8(correctedGreen)
            pixels[index * 4 + 2] = UInt8(correctedBlue)
        }
    }
}

func convertImage(from inputURL: URL, to outputURL: URL) throws {
    guard let source = CGImageSourceCreateWithURL(inputURL as CFURL, nil),
          let original = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
        throw NSError(domain: "FuglerammeArtwork", code: 1,
                      userInfo: [NSLocalizedDescriptionKey: "Could not decode \(inputURL.lastPathComponent)."])
    }

    let scale = min(1.0, maxImageEdge / Double(max(original.width, original.height)))
    let width = max(1, Int((Double(original.width) * scale).rounded()))
    let height = max(1, Int((Double(original.height) * scale).rounded()))
    guard let colorSpace = CGColorSpace(name: CGColorSpace.sRGB),
          let alphaContext = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8,
                                       bytesPerRow: width * 4, space: colorSpace,
                                       bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue |
                                                   CGBitmapInfo.byteOrder32Big.rawValue),
          let context = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8,
                                  bytesPerRow: width * 4, space: colorSpace,
                                  bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue |
                                              CGBitmapInfo.byteOrder32Big.rawValue) else {
        throw NSError(domain: "FuglerammeArtwork", code: 2,
                      userInfo: [NSLocalizedDescriptionKey: "Could not create an sRGB canvas for \(inputURL.lastPathComponent)."])
    }

    alphaContext.clear(CGRect(x: 0, y: 0, width: width, height: height))
    alphaContext.interpolationQuality = .high
    alphaContext.draw(original, in: CGRect(x: 0, y: 0, width: width, height: height))

    context.setFillColor(red: 240.0 / 255.0, green: 236.0 / 255.0, blue: 230.0 / 255.0, alpha: 1.0)
    context.fill(CGRect(x: 0, y: 0, width: width, height: height))
    context.interpolationQuality = .high
    context.draw(original, in: CGRect(x: 0, y: 0, width: width, height: height))
    reducePaleFringe(context.data!.bindMemory(to: UInt8.self, capacity: width * height * 4),
                     alphaMask: UnsafePointer(alphaContext.data!.bindMemory(to: UInt8.self, capacity: width * height * 4)),
                     width: width, height: height)

    guard let flattened = context.makeImage(),
          let destination = CGImageDestinationCreateWithURL(outputURL as CFURL, "public.jpeg" as CFString, 1, nil) else {
        throw NSError(domain: "FuglerammeArtwork", code: 3,
                      userInfo: [NSLocalizedDescriptionKey: "Could not encode \(outputURL.lastPathComponent)."])
    }
    CGImageDestinationAddImage(destination, flattened,
                               [kCGImageDestinationLossyCompressionQuality: jpegQuality] as CFDictionary)
    guard CGImageDestinationFinalize(destination) else {
        throw NSError(domain: "FuglerammeArtwork", code: 4,
                      userInfo: [NSLocalizedDescriptionKey: "Could not finish \(outputURL.lastPathComponent)."])
    }
}

func readJSON(_ url: URL) throws -> JSONObject {
    let data = try Data(contentsOf: url)
    guard let object = try JSONSerialization.jsonObject(with: data) as? JSONObject else {
        throw NSError(domain: "FuglerammeArtwork", code: 5,
                      userInfo: [NSLocalizedDescriptionKey: "Expected an object in \(url.lastPathComponent)."])
    }
    return object
}

func parseEnglishNames(_ url: URL) throws -> [String: String] {
    let content = try String(contentsOf: url, encoding: .utf8)
    var names: [String: String] = [:]
    for line in content.split(whereSeparator: \.isNewline) {
        guard let separator = line.firstIndex(of: "_") else { continue }
        let scientificName = String(line[..<separator])
        let commonName = String(line[line.index(after: separator)...])
        if !scientificName.isEmpty && !commonName.isEmpty {
            names[normalize(scientificName)] = commonName
        }
    }
    return names
}

func main() throws {
    let arguments = Array(CommandLine.arguments.dropFirst())
    guard arguments.count == 2 || (arguments.count == 3 && arguments[2] == "--preview") else {
        stop("Usage: prepare_fugleramme_artwork.swift <downloaded-artwork-directory> <output-directory> [--preview]")
    }

    let sourceRoot = URL(fileURLWithPath: arguments[0], isDirectory: true).standardizedFileURL
    let outputRoot = URL(fileURLWithPath: arguments[1], isDirectory: true).standardizedFileURL
    let selectedPreviewInputs = arguments.count == 3 ? Set(previewInputs) : nil
    let manifest = try readJSON(sourceRoot.appendingPathComponent("manifest.json"))
    let parentAssets = sourceRoot.deletingLastPathComponent()
    let aliases = try readJSON(parentAssets.appendingPathComponent("birdnet_aliases.json"))
    let commonNames = try parseEnglishNames(parentAssets.appendingPathComponent("birdnet_labels_v2.4.txt"))
    var normalizedAliases: [String: String] = [:]
    for (alias, canonical) in aliases {
        if let canonical = canonical as? String {
            normalizedAliases[normalize(alias)] = canonical
        }
    }
    var catalog: JSONObject = [
        "license": licenseName,
        "licenseUrl": licenseURL,
        "attributionUrl": attributionURL,
        "paperColor": paperHex,
        "creator": "Fugleramme contributors",
        "creatorUrl": "https://github.com/arnegiacomo/fugleramme",
        "birds": JSONObject(),
        "perches": [JSONObject]()
    ]

    try FileManager.default.createDirectory(at: outputRoot, withIntermediateDirectories: true)
    var processed = 0
    var processedInputs = Set<String>()
    let sourceDirectories = ["birds", "perches"]

    for folderName in sourceDirectories {
        let folderURL = sourceRoot.appendingPathComponent(folderName, isDirectory: true)
        let outputFolderURL = outputRoot.appendingPathComponent(folderName, isDirectory: true)
        try FileManager.default.createDirectory(at: outputFolderURL, withIntermediateDirectories: true)
        let files = try FileManager.default.contentsOfDirectory(at: folderURL,
                                                               includingPropertiesForKeys: [.isRegularFileKey])
            .filter { $0.pathExtension.lowercased() == "webp" }
            .sorted { $0.lastPathComponent < $1.lastPathComponent }

        for inputURL in files where selectedPreviewInputs == nil || selectedPreviewInputs!.contains("\(folderName)/\(inputURL.lastPathComponent)") {
            let inputPath = "\(folderName)/\(inputURL.lastPathComponent)"
            guard let sourceRecord = manifest[inputPath] as? JSONObject,
                  let sourceTag = sourceRecord["source"] as? String,
                  let sourceURL = sourceRecord["url"] as? String,
                  sourceURL.hasPrefix("https://"),
                  sourceURL.count <= 800,
                  !sourceURL.contains(where: { $0.isWhitespace || $0 == "<" || $0 == ">" || $0 == "\"" || $0 == "\\" }) else {
                stop("The source manifest is missing safe attribution for \(inputPath).")
            }
            let outputName = inputURL.deletingPathExtension().lastPathComponent + ".jpg"
            let outputURL = outputFolderURL.appendingPathComponent(outputName)
            try convertImage(from: inputURL, to: outputURL)
            processedInputs.insert(inputPath)

            let record: JSONObject = [
                "path": "\(folderName)/\(outputName)",
                "source": sourceTag,
                "sourceUrl": sourceURL
            ]
            if folderName == "perches" {
                var perches = catalog["perches"] as! [JSONObject]
                var perch = record
                perch["name"] = inputURL.deletingPathExtension().lastPathComponent
                perches.append(perch)
                catalog["perches"] = perches
            } else {
                let scientificName = speciesName(for: inputURL.lastPathComponent)
                let key = normalize(scientificName)
                let commonName = commonNames[key] ??
                    normalizedAliases[key].flatMap { commonNames[normalize($0)] } ?? scientificName
                var birds = catalog["birds"] as! JSONObject
                var species = birds[key] as? JSONObject ?? [
                    "scientificName": scientificName,
                    "commonName": commonName,
                    "images": [JSONObject]()
                ]
                var images = species["images"] as! [JSONObject]
                images.append(record)
                species["images"] = images
                birds[key] = species
                catalog["birds"] = birds
            }
            processed += 1
        }
    }

    if let selectedPreviewInputs {
        let missing = selectedPreviewInputs.subtracting(processedInputs).sorted()
        if !missing.isEmpty {
            stop("The targeted preview source files are missing: \(missing.joined(separator: ", ")).")
        }
    }

    catalog["aliases"] = aliases
    let outputData = try JSONSerialization.data(withJSONObject: catalog, options: [.prettyPrinted, .sortedKeys])
    try outputData.write(to: outputRoot.appendingPathComponent("catalog.json"), options: .atomic)
    print("Prepared \(processed) \(selectedPreviewInputs == nil ? "artwork images" : "targeted preview images") in \(outputRoot.path).")
}

do {
    try main()
} catch {
    stop(error.localizedDescription)
}
