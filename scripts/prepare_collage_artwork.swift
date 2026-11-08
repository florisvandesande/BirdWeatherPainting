import CoreGraphics
import Foundation
import ImageIO

// Match the existing single-bird display's source resolution while keeping the
// transparent PNG collection small enough for a static web application.
let maxImageEdge = 600.0

typealias JSONObject = [String: Any]

func stop(_ message: String) -> Never {
    fputs("Error: \(message)\n", stderr)
    exit(1)
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

func updateImagePaths(_ catalog: inout JSONObject) throws {
    guard var birds = catalog["birds"] as? JSONObject,
          var perches = catalog["perches"] as? [JSONObject] else {
        throw NSError(domain: "CollageArtwork", code: 6,
                      userInfo: [NSLocalizedDescriptionKey: "The artwork catalog needs bird and perch records."])
    }
    func pngPath(_ value: String) -> String {
        return value.hasSuffix(".jpg") ? String(value.dropLast(4)) + ".png" : value
    }
    for (key, value) in birds {
        guard var bird = value as? JSONObject else { continue }
        if var images = bird["images"] as? [JSONObject] {
            for index in images.indices {
                if let path = images[index]["path"] as? String {
                    images[index]["path"] = pngPath(path)
                }
            }
            bird["images"] = images
            birds[key] = bird
        }
    }
    for index in perches.indices {
        if let path = perches[index]["path"] as? String {
            perches[index]["path"] = pngPath(path)
        }
    }
    catalog["birds"] = birds
    catalog["perches"] = perches
}

func main() throws {
    let arguments = Array(CommandLine.arguments.dropFirst())
    guard arguments.count == 2 else {
        stop("Usage: prepare_collage_artwork.swift <source-artwork-directory> <assets/artwork-output-directory>")
    }
    let sourceRoot = URL(fileURLWithPath: arguments[0], isDirectory: true).standardizedFileURL
    let outputRoot = URL(fileURLWithPath: arguments[1], isDirectory: true).standardizedFileURL
    var catalog = try readJSON(outputRoot.appendingPathComponent("catalog.json"))
    for required in ["geometry.json", "bird_sizes.csv"] {
        guard FileManager.default.fileExists(atPath: outputRoot.appendingPathComponent(required).path) else {
            stop("Required supporting data is missing: \(outputRoot.appendingPathComponent(required).path)")
        }
    }

    var processed = 0
    for folder in ["birds", "perches"] {
        let folderURL = sourceRoot.appendingPathComponent(folder, isDirectory: true)
        let outputFolder = outputRoot.appendingPathComponent(folder, isDirectory: true)
        try FileManager.default.createDirectory(at: outputFolder, withIntermediateDirectories: true)
        let files = try FileManager.default.contentsOfDirectory(at: folderURL,
            includingPropertiesForKeys: [.isRegularFileKey]).filter { $0.pathExtension.lowercased() == "webp" }
            .sorted { $0.lastPathComponent < $1.lastPathComponent }
        for file in files {
            let sourceName = file.deletingPathExtension().lastPathComponent
            guard sourceName.range(of: #"^[a-z0-9_-]+$"#, options: .regularExpression) != nil else {
                stop("The source filename is not a safe artwork name: \(file.lastPathComponent)")
            }
            let outputName = file.deletingPathExtension().lastPathComponent + ".png"
            let outputURL = outputFolder.appendingPathComponent(outputName)
            try writePNG(from: file, to: outputURL)
            processed += 1
        }
    }
    try updateImagePaths(&catalog)
    let output = try JSONSerialization.data(withJSONObject: catalog, options: [.prettyPrinted, .sortedKeys])
    try output.write(to: outputRoot.appendingPathComponent("catalog.json"), options: .atomic)
    print("Prepared \(processed) collage images in \(outputRoot.path).")
}

do {
    try main()
} catch {
    stop(error.localizedDescription)
}
