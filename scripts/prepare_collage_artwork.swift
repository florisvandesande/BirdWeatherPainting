import CoreGraphics
import Foundation
import ImageIO

let licenseName = "CC BY-SA 4.0"
let licenseURL = "https://creativecommons.org/licenses/by-sa/4.0/"
let attributionURL = "https://github.com/arnegiacomo/fugleramme/blob/main/assets/artwork/classic/ATTRIBUTION.md"
let maxImageEdge = 1200.0

typealias JSONObject = [String: Any]

func stop(_ message: String) -> Never {
    fputs("Error: \(message)\n", stderr)
    exit(1)
}

func normalize(_ value: String) -> String {
    return value.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
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
    guard let first = words.first else { return stem }
    return ([first.capitalized] + words.dropFirst().map(String.init)).joined(separator: " ")
}

func readJSON(_ url: URL) throws -> JSONObject {
    let data = try Data(contentsOf: url)
    guard let object = try JSONSerialization.jsonObject(with: data) as? JSONObject else {
        throw NSError(domain: "CollageArtwork", code: 1,
                      userInfo: [NSLocalizedDescriptionKey: "Expected a JSON object in \(url.lastPathComponent)."])
    }
    return object
}

func writePNG(from sourceURL: URL, to outputURL: URL) throws {
    guard let source = CGImageSourceCreateWithURL(sourceURL as CFURL, nil),
          let original = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
        throw NSError(domain: "CollageArtwork", code: 2,
                      userInfo: [NSLocalizedDescriptionKey: "Could not decode \(sourceURL.lastPathComponent)."])
    }
    let scale = min(1.0, maxImageEdge / Double(max(original.width, original.height)))
    let width = max(1, Int((Double(original.width) * scale).rounded()))
    let height = max(1, Int((Double(original.height) * scale).rounded()))
    guard let colorSpace = CGColorSpace(name: CGColorSpace.sRGB),
          let context = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8,
                                  bytesPerRow: width * 4, space: colorSpace,
                                  bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue |
                                              CGBitmapInfo.byteOrder32Big.rawValue) else {
        throw NSError(domain: "CollageArtwork", code: 3,
                      userInfo: [NSLocalizedDescriptionKey: "Could not create an image canvas."])
    }
    context.clear(CGRect(x: 0, y: 0, width: width, height: height))
    context.interpolationQuality = .high
    context.draw(original, in: CGRect(x: 0, y: 0, width: width, height: height))
    guard let image = context.makeImage(),
          let destination = CGImageDestinationCreateWithURL(outputURL as CFURL, "public.png" as CFString, 1, nil) else {
        throw NSError(domain: "CollageArtwork", code: 4,
                      userInfo: [NSLocalizedDescriptionKey: "Could not encode \(outputURL.lastPathComponent)."])
    }
    CGImageDestinationAddImage(destination, image, nil)
    guard CGImageDestinationFinalize(destination) else {
        throw NSError(domain: "CollageArtwork", code: 5,
                      userInfo: [NSLocalizedDescriptionKey: "Could not finish \(outputURL.lastPathComponent)."])
    }
}

func parseNames(_ url: URL) throws -> [String: String] {
    let content = try String(contentsOf: url, encoding: .utf8)
    var names: [String: String] = [:]
    for line in content.split(whereSeparator: \.isNewline) {
        guard let separator = line.firstIndex(of: "_") else { continue }
        let scientific = String(line[..<separator])
        let common = String(line[line.index(after: separator)...])
        if !scientific.isEmpty && !common.isEmpty {
            names[normalize(scientific)] = common
        }
    }
    return names
}

func main() throws {
    let arguments = Array(CommandLine.arguments.dropFirst())
    guard arguments.count == 2 else {
        stop("Usage: prepare_collage_artwork.swift <source-artwork-directory> <assets/artwork-output-directory>")
    }
    let sourceRoot = URL(fileURLWithPath: arguments[0], isDirectory: true).standardizedFileURL
    let outputRoot = URL(fileURLWithPath: arguments[1], isDirectory: true).standardizedFileURL
    let parent = sourceRoot.deletingLastPathComponent()
    let manifest = try readJSON(sourceRoot.appendingPathComponent("manifest.json"))
    let aliases = try readJSON(parent.appendingPathComponent("birdnet_aliases.json"))
    let names = try parseNames(parent.appendingPathComponent("birdnet_labels_v2.4.txt"))
    for required in ["geometry.json", "bird_sizes.csv"] {
        guard FileManager.default.fileExists(atPath: outputRoot.appendingPathComponent(required).path) else {
            stop("Required supporting data is missing: \(outputRoot.appendingPathComponent(required).path)")
        }
    }

    var catalog: JSONObject = [
        "license": licenseName,
        "licenseUrl": licenseURL,
        "attributionUrl": attributionURL,
        "paperColor": "#f0ece6",
        "creator": "Fugleramme contributors",
        "creatorUrl": "https://github.com/arnegiacomo/fugleramme",
        "birds": JSONObject(),
        "perches": [JSONObject]()
    ]
    var birdCatalog = JSONObject()
    var perches = [JSONObject]()
    var processed = 0
    for folder in ["birds", "perches"] {
        let folderURL = sourceRoot.appendingPathComponent(folder, isDirectory: true)
        let outputFolder = outputRoot.appendingPathComponent(folder, isDirectory: true)
        try FileManager.default.createDirectory(at: outputFolder, withIntermediateDirectories: true)
        let files = try FileManager.default.contentsOfDirectory(at: folderURL,
            includingPropertiesForKeys: [.isRegularFileKey]).filter { $0.pathExtension.lowercased() == "webp" }
            .sorted { $0.lastPathComponent < $1.lastPathComponent }
        for file in files {
            let relativeInput = "\(folder)/\(file.lastPathComponent)"
            let sourceName = file.deletingPathExtension().lastPathComponent
            guard sourceName.range(of: #"^[a-z0-9_-]+$"#, options: .regularExpression) != nil else {
                stop("The source filename is not a safe artwork name: \(file.lastPathComponent)")
            }
            guard let sourceRecord = manifest[relativeInput] as? JSONObject,
                  let sourceTag = sourceRecord["source"] as? String,
                  let sourceURL = sourceRecord["url"] as? String,
                  !sourceTag.isEmpty, sourceTag.count <= 80,
                  sourceURL.hasPrefix("https://"), sourceURL.count <= 800,
                  !sourceURL.contains(where: { $0.isWhitespace || $0 == "<" || $0 == ">" || $0 == "\"" || $0 == "\\" }) else {
                stop("The source manifest is missing a safe source URL for \(relativeInput).")
            }
            let outputName = file.deletingPathExtension().lastPathComponent + ".png"
            let outputURL = outputFolder.appendingPathComponent(outputName)
            try writePNG(from: file, to: outputURL)
            let record: JSONObject = ["path": "\(folder)/\(outputName)", "source": sourceTag, "sourceUrl": sourceURL]
            if folder == "perches" {
                var perch = record
                perch["name"] = file.deletingPathExtension().lastPathComponent
                perches.append(perch)
            } else {
                let scientific = speciesName(for: file.lastPathComponent)
                let key = normalize(scientific)
                let common = names[key] ?? scientific
                var species = birdCatalog[key] as? JSONObject ?? [
                    "scientificName": scientific,
                    "commonName": common,
                    "images": [JSONObject]()
                ]
                var images = species["images"] as? [JSONObject] ?? []
                images.append(record)
                species["images"] = images
                birdCatalog[key] = species
            }
            processed += 1
        }
    }
    var normalizedAliases = JSONObject()
    for (alias, canonical) in aliases {
        if let canonical = canonical as? String {
            normalizedAliases[alias] = canonical
        }
    }
    catalog["aliases"] = normalizedAliases
    catalog["birds"] = birdCatalog
    catalog["perches"] = perches
    let output = try JSONSerialization.data(withJSONObject: catalog, options: [.prettyPrinted, .sortedKeys])
    try output.write(to: outputRoot.appendingPathComponent("catalog.json"), options: .atomic)
    print("Prepared \(processed) collage images in \(outputRoot.path).")
}

do {
    try main()
} catch {
    stop(error.localizedDescription)
}
