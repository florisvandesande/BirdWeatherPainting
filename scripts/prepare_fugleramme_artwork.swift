import CoreGraphics
import Foundation
import ImageIO

let licenseName = "CC BY-SA 4.0"
let licenseURL = "https://creativecommons.org/licenses/by-sa/4.0/"
let attributionURL = "https://github.com/arnegiacomo/fugleramme/blob/main/assets/artwork/classic/ATTRIBUTION.md"
let paperHex = "#f0ece6"
let maxImageEdge = 600.0
let jpegQuality = 0.68

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
          let context = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8,
                                  bytesPerRow: width * 4, space: colorSpace,
                                  bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue |
                                              CGBitmapInfo.byteOrder32Big.rawValue) else {
        throw NSError(domain: "FuglerammeArtwork", code: 2,
                      userInfo: [NSLocalizedDescriptionKey: "Could not create an sRGB canvas for \(inputURL.lastPathComponent)."])
    }

    context.setFillColor(red: 240.0 / 255.0, green: 236.0 / 255.0, blue: 230.0 / 255.0, alpha: 1.0)
    context.fill(CGRect(x: 0, y: 0, width: width, height: height))
    context.interpolationQuality = .high
    context.draw(original, in: CGRect(x: 0, y: 0, width: width, height: height))

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
    guard arguments.count == 2 || arguments.count == 4,
          arguments.count == 2 || (arguments[2] == "--limit" && Int(arguments[3]) != nil && Int(arguments[3])! > 0) else {
        stop("Usage: prepare_fugleramme_artwork.swift <downloaded-artwork-directory> <output-directory> [--limit <number-for-a-small-preview>]")
    }

    let sourceRoot = URL(fileURLWithPath: arguments[0], isDirectory: true).standardizedFileURL
    let outputRoot = URL(fileURLWithPath: arguments[1], isDirectory: true).standardizedFileURL
    let previewLimit = arguments.count == 4 ? Int(arguments[3]) : nil
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
    let sourceDirectories = ["birds", "perches"]

    for folderName in sourceDirectories {
        let folderURL = sourceRoot.appendingPathComponent(folderName, isDirectory: true)
        let outputFolderURL = outputRoot.appendingPathComponent(folderName, isDirectory: true)
        try FileManager.default.createDirectory(at: outputFolderURL, withIntermediateDirectories: true)
        let files = try FileManager.default.contentsOfDirectory(at: folderURL,
                                                               includingPropertiesForKeys: [.isRegularFileKey])
            .filter { $0.pathExtension.lowercased() == "webp" }
            .sorted { $0.lastPathComponent < $1.lastPathComponent }

        for inputURL in files {
            if let previewLimit, processed >= previewLimit { break }
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
        if let previewLimit, processed >= previewLimit { break }
    }

    catalog["aliases"] = aliases
    let outputData = try JSONSerialization.data(withJSONObject: catalog, options: [.prettyPrinted, .sortedKeys])
    try outputData.write(to: outputRoot.appendingPathComponent("catalog.json"), options: .atomic)
    print("Prepared \(processed) images in \(outputRoot.path).")
}

do {
    try main()
} catch {
    stop(error.localizedDescription)
}
