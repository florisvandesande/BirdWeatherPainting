import AppKit

struct PetConfig: Codable {
    struct Size: Codable { let width: Int; let height: Int }
    struct Sheet: Codable { let width: Int; let height: Int; let columns: Int; let rows: Int }
    struct Anchor: Codable { let x: Double; let y: Double; let meaning: String }
    struct Animation: Codable { let row: Int; let firstFrame: Int; let frameCount: Int; let fps: Double; let loop: Bool; let movementSpeed: Double }
    struct AutonomousWalking: Codable { let minDistanceFraction: Double; let maxDistanceFraction: Double; let leftTurnZoneEnd: Double; let rightTurnZoneStart: Double }
    struct ReminderDefaults: Codable { let enabled: Bool; let intervalMinutes: Int; let water: Bool; let `break`: Bool; let encouragement: Bool }
    let schemaVersion: Int; let id: String; let displayName: String; let description: String
    let spritesheetPath: String; let sheet: Sheet; let cell: Size; let anchor: Anchor
    let animations: [String: Animation]; let transitions: [String: [String]]
    let spontaneousWeights: [String: Int]; let interactionDefaults: [String: String]
    let reminderDefaults: ReminderDefaults; let autonomousWalking: AutonomousWalking?
}

final class SpriteAtlas {
    let config: PetConfig
    private let image: CGImage
    private var cache: [String: [NSImage]] = [:]
    init() throws {
        guard let jsonURL = Bundle.main.url(forResource: "pet", withExtension: "json") else { throw NSError(domain: "DeskPet", code: 1) }
        config = try JSONDecoder().decode(PetConfig.self, from: Data(contentsOf: jsonURL))
        let name = (config.spritesheetPath as NSString).deletingPathExtension
        let ext = (config.spritesheetPath as NSString).pathExtension
        guard let url = Bundle.main.url(forResource: name, withExtension: ext), let source = NSImage(contentsOf: url),
              let cg = source.cgImage(forProposedRect: nil, context: nil, hints: nil) else { throw NSError(domain: "DeskPet", code: 2) }
        image = cg
    }
    func frames(named name: String) -> [NSImage] {
        if let value = cache[name] { return value }
        guard let a = config.animations[name] else { return [] }
        let value = (0..<a.frameCount).compactMap { i -> NSImage? in
            let rect = CGRect(x: (a.firstFrame + i) * config.cell.width, y: a.row * config.cell.height,
                              width: config.cell.width, height: config.cell.height)
            guard let crop = image.cropping(to: rect) else { return nil }
            return NSImage(cgImage: crop, size: NSSize(width: config.cell.width, height: config.cell.height))
        }
        cache[name] = value
        return value
    }
}

final class PetView: NSView {
    let sprite = NSImageView(); let bubble = NSTextField(wrappingLabelWithString: "")
    var onSingleClick: (() -> Void)?; var onDoubleClick: (() -> Void)?
    var onDragStart: (() -> Void)?; var onDragEnd: (() -> Void)?
    var onDragMove: ((CGFloat, CGFloat) -> Void)?
    var onCursorNear: (() -> Void)?; var onPetting: (() -> Void)?; var onMenu: ((NSEvent) -> Void)?
    private var downAt: NSPoint?; private var windowAt: NSPoint?; private var didDrag = false
    private var lastMouseX: CGFloat?; private var lastDirection = 0; private var strokes: [TimeInterval] = []
    private var mirroredFrames: [ObjectIdentifier: NSImage] = [:]
    private var lastFrame: NSImage?; private var lastFacingRight: Bool?
    override init(frame: NSRect) {
        super.init(frame: frame); wantsLayer = true
        sprite.frame = NSRect(x: 10, y: 0, width: 256, height: 256); sprite.imageScaling = .scaleProportionallyUpOrDown; sprite.wantsLayer = true; addSubview(sprite)
        bubble.font = .systemFont(ofSize: 13, weight: .medium); bubble.textColor = .labelColor
        bubble.backgroundColor = NSColor.windowBackgroundColor.withAlphaComponent(0.96); bubble.drawsBackground = true
        bubble.isBezeled = true; bubble.bezelStyle = .roundedBezel; bubble.alignment = .center
        bubble.frame = NSRect(x: 8, y: 258, width: 260, height: 48); bubble.alphaValue = 0; addSubview(bubble)
        addTrackingArea(NSTrackingArea(rect: bounds, options: [.mouseEnteredAndExited, .mouseMoved, .activeAlways, .inVisibleRect], owner: self))
    }
    required init?(coder: NSCoder) { fatalError() }
    func show(frame image: NSImage, facingRight: Bool) {
        if lastFrame === image && lastFacingRight == facingRight { return }
        lastFrame = image; lastFacingRight = facingRight
        if facingRight {
            sprite.image = image
        } else {
            let key = ObjectIdentifier(image)
            if let cached = mirroredFrames[key] {
                sprite.image = cached
            } else {
                let mirrored = NSImage(size: image.size, flipped: false) { rect in
                    guard let context = NSGraphicsContext.current?.cgContext else { return false }
                    context.saveGState(); context.translateBy(x: rect.width, y: 0); context.scaleBy(x: -1, y: 1)
                    image.draw(in: rect); context.restoreGState(); return true
                }
                mirroredFrames[key] = mirrored; sprite.image = mirrored
            }
        }
    }
    func say(_ text: String) {
        bubble.stringValue = text; bubble.animator().alphaValue = 1
        DispatchQueue.main.asyncAfter(deadline: .now() + 4.5) { [weak self] in self?.bubble.animator().alphaValue = 0 }
    }
    override func mouseEntered(with event: NSEvent) { onCursorNear?() }
    override func mouseMoved(with event: NSEvent) {
        let p = convert(event.locationInWindow, from: nil); guard p.y > 130 else { return }
        if let previous = lastMouseX {
            let delta = p.x - previous; let direction = delta > 3 ? 1 : (delta < -3 ? -1 : 0)
            if direction != 0 && lastDirection != 0 && direction != lastDirection {
                let now = Date.timeIntervalSinceReferenceDate; strokes.append(now); strokes.removeAll { now - $0 > 2.2 }
                if strokes.count >= 4 { strokes.removeAll(); onPetting?() }
            }
            if direction != 0 { lastDirection = direction }
        }
        lastMouseX = p.x
    }
    override func mouseDown(with event: NSEvent) {
        if event.clickCount == 2 { onDoubleClick?(); return }
        downAt = NSEvent.mouseLocation; windowAt = window?.frame.origin; didDrag = false
    }
    override func mouseDragged(with event: NSEvent) {
        guard let start = downAt, let origin = windowAt else { return }; let now = NSEvent.mouseLocation
        if !didDrag { didDrag = true; onDragStart?() }
        onDragMove?(now.x - start.x, now.y - start.y)
        window?.setFrameOrigin(NSPoint(x: origin.x + now.x - start.x, y: origin.y + now.y - start.y))
    }
    override func mouseUp(with event: NSEvent) { if didDrag { onDragEnd?() } else if event.clickCount == 1 { onSingleClick?() } }
    override func rightMouseDown(with event: NSEvent) { onMenu?(event) }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    private var window: NSWindow!; private var view: PetView!; private var atlas: SpriteAtlas!
    private var displayTimer: Timer?; private var behaviorTimer: Timer?; private var reminderTimer: Timer?
    private var animationName = "idle"; private var frameIndex = 0; private var elapsed = 0.0
    private var lastTick = Date.timeIntervalSinceReferenceDate; private var facingRight = false
    private var walkingDirection: CGFloat = -1
    private var walking = false; private var paused = false; private var pendingDirectionFlip = false
    private var userDragging = false; private var walkingDeadline = 0.0
    private var walkingTargetX: CGFloat?
    private let defaults = UserDefaults.standard
    private let encouragements = ["Je doet het beter dan je denkt. ♥", "Eén stapje tegelijk. Ik geloof in je!", "Ik ben blij dat jij er bent!"]
    private let waterMessages = ["Klein slokje water? Ik wacht wel even.", "Misschien verdien je nu wat water."]
    private let breakMessages = ["Zullen we onze schouders even ontspannen?", "Een mini-pauze telt ook. Ik blijf hier."]
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory)
        do { atlas = try SpriteAtlas() } catch { NSAlert(error: error).runModal(); NSApp.terminate(nil); return }
        defaults.register(defaults: ["remindersEnabled": true, "reminderInterval": 45, "waterReminder": true, "breakReminder": true, "encouragementReminder": true])
        let size = NSSize(width: 276, height: 308)
        window = NSWindow(contentRect: NSRect(origin: .zero, size: size), styleMask: [.borderless], backing: .buffered, defer: false)
        window.isOpaque = false; window.backgroundColor = .clear; window.hasShadow = false; window.level = .floating
        window.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary]; window.title = "\(atlas.config.displayName) DeskPet"
        view = PetView(frame: NSRect(origin: .zero, size: size)); wireInteractions(); window.contentView = view
        placeAtBottomRight(); window.orderFrontRegardless(); play("idle", force: true); view.say("Hoi! Ik ben \(atlas.config.displayName). Aai, klik of sleep me gerust.")
        displayTimer = Timer.scheduledTimer(timeInterval: 1.0 / 30.0, target: self, selector: #selector(tick), userInfo: nil, repeats: true)
        scheduleBehavior(); scheduleReminder()
    }
    private func wireInteractions() {
        view.onSingleClick = { [weak self] in self?.play("wave", force: true) }
        view.onDoubleClick = { [weak self] in self?.play("hug", force: true); self?.view.say("Een knuffel voor jou!") }
        view.onDragStart = { [weak self] in self?.userDragging = true; self?.walking = false; self?.play("pickedUp", force: true) }
        view.onDragMove = { [weak self] dx, dy in
            guard let self else { return }
            if abs(dx) > abs(dy) + 8 {
                self.setWalkingDirection(dx > 0 ? 1 : -1); self.walking = true
                if self.animationName != "walk" { self.play("walk", force: true) }
            } else if self.animationName != "pickedUp" {
                self.walking = false; self.play("pickedUp", force: true)
            }
        }
        view.onDragEnd = { [weak self] in self?.userDragging = false; self?.walking = false; self?.play("happy", force: true) }
        view.onCursorNear = { [weak self] in guard self?.animationName == "idle" else { return }; self?.play("attention") }
        view.onPetting = { [weak self] in self?.play("happy", force: true); self?.view.say("Hihi… dat kriebelt! ♥") }
        view.onMenu = { [weak self] event in self?.showMenu(event) }
    }
    private func placeAtBottomRight() {
        guard let s = NSScreen.main else { return }; window.setFrameOrigin(NSPoint(x: s.visibleFrame.maxX - window.frame.width - 24, y: s.visibleFrame.minY + 8))
    }
    private func play(_ name: String, force: Bool = false) {
        guard atlas.config.animations[name] != nil else { return }
        if !force && animationName != "idle" && animationName != "walk" { return }
        animationName = name; frameIndex = 0; elapsed = 0; render()
    }
    @objc private func tick() {
        let now = Date.timeIntervalSinceReferenceDate; let dt = min(0.1, now - lastTick); lastTick = now
        guard !paused, let spec = atlas.config.animations[animationName] else { return }
        elapsed += dt; let duration = 1.0 / spec.fps
        while elapsed >= duration { elapsed -= duration; frameIndex += 1; if frameIndex >= spec.frameCount { if spec.loop { frameIndex = 0 } else { finishAnimation(); break } } }
        if animationName == "walk" && walking && !userDragging {
            if now >= walkingDeadline { walking = false; play("idle", force: true) }
            else {
                let step = CGFloat(spec.movementSpeed * dt) * walkingDirection
                if let target = walkingTargetX,
                   (walkingDirection > 0 ? window.frame.origin.x + step >= target : window.frame.origin.x + step <= target) {
                    var point = window.frame.origin; point.x = target; window.setFrameOrigin(point)
                    walking = false; walkingTargetX = nil; play("idle", force: true)
                } else { moveBy(step) }
            }
        }
        render()
    }
    private func render() {
        let frames = atlas.frames(named: animationName); guard !frames.isEmpty else { return }
        view.show(frame: frames[min(frameIndex, frames.count - 1)], facingRight: facingRight)
    }
    private func finishAnimation() {
        if animationName == "turn" {
            startAutonomousWalk(direction: -walkingDirection)
            pendingDirectionFlip = false; walking = true; animationName = "walk"
        }
        else if animationName == "pickedUp" { frameIndex = 3; return }
        else { walking = false; animationName = "idle" }
        frameIndex = 0
    }
    private func moveBy(_ dx: CGFloat) {
        guard let screen = window.screen ?? NSScreen.main else { return }; var p = window.frame.origin; p.x += dx
        let minX = screen.visibleFrame.minX, maxX = screen.visibleFrame.maxX - window.frame.width
        if p.x <= minX || p.x >= maxX { p.x = min(max(p.x, minX), maxX); if !pendingDirectionFlip { pendingDirectionFlip = true; walking = false; play("turn", force: true) } }
        window.setFrameOrigin(p)
    }
    private func setWalkingDirection(_ direction: CGFloat) {
        walkingDirection = direction >= 0 ? 1 : -1
        facingRight = walkingDirection > 0
    }
    private func startAutonomousWalk(direction: CGFloat) {
        guard let screen = window.screen ?? NSScreen.main,
              let spec = atlas.config.animations["walk"] else { return }
        setWalkingDirection(direction)
        let minimum = CGFloat(atlas.config.autonomousWalking?.minDistanceFraction ?? 0.10)
        let maximum = CGFloat(atlas.config.autonomousWalking?.maxDistanceFraction ?? 0.70)
        let fraction = CGFloat.random(in: minimum...maximum)
        let distance = screen.visibleFrame.width * fraction
        let minX = screen.visibleFrame.minX
        let maxX = screen.visibleFrame.maxX - window.frame.width
        walkingTargetX = min(max(window.frame.origin.x + walkingDirection * distance, minX), maxX)
        let actualDistance = abs((walkingTargetX ?? window.frame.origin.x) - window.frame.origin.x)
        walkingDeadline = Date.timeIntervalSinceReferenceDate + Double(actualDistance / max(CGFloat(spec.movementSpeed), 1)) + 3
        walking = true
    }
    private func scheduleBehavior() {
        behaviorTimer?.invalidate(); behaviorTimer = Timer.scheduledTimer(withTimeInterval: Double.random(in: 14...28), repeats: false) { [weak self] _ in self?.chooseBehavior(); self?.scheduleBehavior() }
    }
    private func chooseBehavior() {
        guard !paused, animationName == "idle" else { return }
        let choices = atlas.config.spontaneousWeights.flatMap { name, weight in Array(repeating: name, count: weight) }
        guard let choice = choices.randomElement() else { return }
        if choice == "walk" {
            if let screen = window.screen ?? NSScreen.main {
                let leftRoom = window.frame.minX - screen.visibleFrame.minX
                let rightRoom = screen.visibleFrame.maxX - window.frame.maxX
                if rightRoom < 8 { setWalkingDirection(-1) }
                else if leftRoom < 8 { setWalkingDirection(1) }
                else {
                    let petCenter = window.frame.midX
                    let leftZone = CGFloat(atlas.config.autonomousWalking?.leftTurnZoneEnd ?? 0.25)
                    let rightZone = CGFloat(atlas.config.autonomousWalking?.rightTurnZoneStart ?? 0.75)
                    let leftQuarter = screen.visibleFrame.minX + screen.visibleFrame.width * leftZone
                    let rightQuarter = screen.visibleFrame.minX + screen.visibleFrame.width * rightZone
                    if petCenter <= leftQuarter { setWalkingDirection(1) }
                    else if petCenter >= rightQuarter { setWalkingDirection(-1) }
                }
            }
            startAutonomousWalk(direction: walkingDirection)
        }
        play(choice)
    }
    private func scheduleReminder() {
        reminderTimer?.invalidate(); guard defaults.bool(forKey: "remindersEnabled") else { return }
        let minutes = max(1, defaults.integer(forKey: "reminderInterval"))
        reminderTimer = Timer.scheduledTimer(withTimeInterval: Double(minutes * 60), repeats: true) { [weak self] _ in self?.showReminder() }
    }
    private func showReminder() {
        var groups: [[String]] = []
        if defaults.bool(forKey: "waterReminder") { groups.append(waterMessages) }
        if defaults.bool(forKey: "breakReminder") { groups.append(breakMessages) }
        if defaults.bool(forKey: "encouragementReminder") { groups.append(encouragements) }
        if let message = groups.randomElement()?.randomElement() { play("attention", force: true); view.say(message) }
    }
    private func showMenu(_ event: NSEvent) {
        let menu = NSMenu(); add(menu, "Laat \(atlas.config.displayName) zwaaien", #selector(menuWave)); add(menu, "Geef een knuffel", #selector(menuHug)); add(menu, "Zeg iets liefs", #selector(menuSpeak)); menu.addItem(.separator())
        let settings = NSMenu(); toggle(settings, "Reminders", "remindersEnabled"); toggle(settings, "Water", "waterReminder"); toggle(settings, "Pauze", "breakReminder"); toggle(settings, "Aanmoediging", "encouragementReminder"); settings.addItem(.separator())
        for minutes in [30, 45, 60] { let item = NSMenuItem(title: "Elke \(minutes) minuten", action: #selector(setInterval(_:)), keyEquivalent: ""); item.target = self; item.tag = minutes; item.state = defaults.integer(forKey: "reminderInterval") == minutes ? .on : .off; settings.addItem(item) }
        let settingsItem = NSMenuItem(title: "Reminders instellen", action: nil, keyEquivalent: ""); menu.setSubmenu(settings, for: settingsItem); menu.addItem(settingsItem); menu.addItem(.separator())
        add(menu, paused ? "Animaties hervatten" : "Animaties pauzeren", #selector(togglePause)); add(menu, "Stop \(atlas.config.displayName) DeskPet", #selector(terminateApp)); NSMenu.popUpContextMenu(menu, with: event, for: view)
    }
    private func add(_ menu: NSMenu, _ title: String, _ action: Selector) { let item = NSMenuItem(title: title, action: action, keyEquivalent: ""); item.target = self; menu.addItem(item) }
    private func toggle(_ menu: NSMenu, _ title: String, _ key: String) { let item = NSMenuItem(title: title, action: #selector(toggleReminder(_:)), keyEquivalent: ""); item.target = self; item.representedObject = key; item.state = defaults.bool(forKey: key) ? .on : .off; menu.addItem(item) }
    @objc private func menuWave() { play("wave", force: true) }
    @objc private func menuHug() { play("hug", force: true) }
    @objc private func menuSpeak() { play("attention", force: true); view.say(encouragements.randomElement()!) }
    @objc private func togglePause() { paused.toggle(); walking = false; if !paused { play("idle", force: true) } }
    @objc private func toggleReminder(_ sender: NSMenuItem) { guard let key = sender.representedObject as? String else { return }; defaults.set(!defaults.bool(forKey: key), forKey: key); scheduleReminder() }
    @objc private func setInterval(_ sender: NSMenuItem) { defaults.set(sender.tag, forKey: "reminderInterval"); scheduleReminder() }
    @objc private func terminateApp() { NSApp.terminate(nil) }
}

let app = NSApplication.shared
let delegate = AppDelegate(); app.delegate = delegate; app.run()
