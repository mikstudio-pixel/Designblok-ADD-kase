import CoreMotion
import UIKit
import WebKit

private final class WeakScriptHandler: NSObject, WKScriptMessageHandler {
    weak var target: WKScriptMessageHandler?
    init(_ target: WKScriptMessageHandler) { self.target = target }
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        target?.userContentController(controller, didReceive: message)
    }
}

final class KioskViewController: UIViewController, WKScriptMessageHandler, WKNavigationDelegate {
    private var webView: WKWebView!
    private let curtain = UIControl()
    private let motion = CMMotionManager()
    private let tray = TrayBluetooth()
    private let setupButton = UIButton(type: .system)
    private var activity = MotionActivity()
    private var idleTimer: Timer?
    private var lastActivity = ProcessInfo.processInfo.systemUptime
    private var active = false
    private var sleeping = false
    private var pageReady = false
    private var tiltEnabled = false
    private var originalBrightness: CGFloat?
    private weak var controlledScreen: UIScreen?
    private var motionFailed = false
    private var sendingMotion = false
    private var sendingSync = false
    private var syncDirty = false
    private var webGeneration = 0
    private var sensorGeneration = 0
    private let idleSeconds = max(5, (Bundle.main.object(forInfoDictionaryKey: "KioskIdleSeconds") as? Double) ?? 30)
    private let activeBrightness = min(1, max(0.05, (Bundle.main.object(forInfoDictionaryKey: "KioskActiveBrightness") as? Double) ?? 1.0))
    private var webRoot: URL { Bundle.main.bundleURL.appendingPathComponent("Web", isDirectory: true) }

    override var prefersStatusBarHidden: Bool { true }
    override var prefersHomeIndicatorAutoHidden: Bool { true }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        let configuration = WKWebViewConfiguration()
        configuration.userContentController.add(WeakScriptHandler(self), name: "michas")
        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.isOpaque = false
        webView.backgroundColor = .black
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.bounces = false
        #if DEBUG
        if #available(iOS 16.4, *) { webView.isInspectable = true }
        #endif
        curtain.backgroundColor = .black
        curtain.isHidden = true
        curtain.accessibilityLabel = "Probudit pohybovou studii"
        curtain.accessibilityTraits = .button
        curtain.addTarget(self, action: #selector(wake), for: .touchDown)
        for child in [webView!, curtain] {
            child.translatesAutoresizingMaskIntoConstraints = false
            view.addSubview(child)
            NSLayoutConstraint.activate([
                child.leadingAnchor.constraint(equalTo: view.leadingAnchor),
                child.trailingAnchor.constraint(equalTo: view.trailingAnchor),
                child.topAnchor.constraint(equalTo: view.topAnchor),
                child.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            ])
        }
        setupButton.setTitle("iPady", for: .normal)
        setupButton.accessibilityLabel = "Nastavení propojení iPadů"
        setupButton.backgroundColor = UIColor(white: 0.1, alpha: 0.9)
        setupButton.tintColor = .lightGray
        setupButton.layer.cornerRadius = 8
        setupButton.addTarget(self, action: #selector(showTraySetup), for: .touchUpInside)
        setupButton.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(setupButton)
        NSLayoutConstraint.activate([
            setupButton.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -12),
            setupButton.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -12),
            setupButton.widthAnchor.constraint(equalToConstant: 64),
            setupButton.heightAnchor.constraint(equalToConstant: 44),
        ])
        tray.onChange = { [weak self] _ in self?.publishSync() }
        tray.onRemotePower = { [weak self] sleeping in self?.applyRemotePower(sleeping) }
        tray.onWake = { [weak self] in
            self?.lastActivity = ProcessInfo.processInfo.systemUptime
            self?.wake()
        }
        loadWebApp()
    }

    private func loadWebApp() {
        webGeneration += 1
        sendingMotion = false
        sendingSync = false
        syncDirty = false
        pageReady = false
        tiltEnabled = false
        tray.setRendererReady(false)
        let sync = json(tray.view) ?? "null"
        webView.configuration.userContentController.removeAllUserScripts()
        webView.configuration.userContentController.addUserScript(WKUserScript(
            source: "window.__michasNative = {paused: \(sleeping || !active), sync: \(sync)};",
            injectionTime: .atDocumentStart, forMainFrameOnly: true
        ))
        webView.loadFileURL(webRoot.appendingPathComponent("index.html"), allowingReadAccessTo: webRoot)
    }

    func activate() {
        loadViewIfNeeded()
        guard !active else { return }
        active = true
        controlledScreen = view.window?.windowScene?.screen
        originalBrightness = controlledScreen?.brightness
        // Keep the process in the foreground for motion wake. Brightness 0 is
        // minimum brightness, not a public API for switching the panel off.
        UIApplication.shared.isIdleTimerDisabled = true
        sleeping = false
        curtain.isHidden = true
        controlledScreen?.brightness = CGFloat(activeBrightness)
        lastActivity = ProcessInfo.processInfo.systemUptime
        tray.setSleeping(false)
        tray.setRendererReady(pageReady)
        tray.setActive(true)
        startSensors()
        startIdleTimer()
        publishPower()
    }

    func deactivate() {
        guard active else { return }
        active = false
        // Permission/pairing dialogs also resign active. Keep BLE alive until
        // the scene actually enters the background, or pairing is interrupted.
        tray.setRendererReady(false)
        stopSensors()
        idleTimer?.invalidate()
        idleTimer = nil
        publishPower()
        curtain.isHidden = false
        if let originalBrightness { controlledScreen?.brightness = originalBrightness }
        originalBrightness = nil
        UIApplication.shared.isIdleTimerDisabled = false
    }

    func suspendNetworking() { tray.setActive(false) }

    func touchActivity() {
        // The curtain consumes the wake touch; it must not alter a slider below.
        if active && !sleeping { lastActivity = ProcessInfo.processInfo.systemUptime }
    }

    private func startIdleTimer() {
        idleTimer?.invalidate()
        idleTimer = nil
        guard !tray.role.isDisplay else { return }
        let timer = Timer(timeInterval: 1, repeats: true) { [weak self] _ in
            guard let self, self.active, !self.sleeping, self.presentedViewController == nil else { return }
            if ProcessInfo.processInfo.systemUptime - self.lastActivity >= self.idleSeconds { self.sleep() }
        }
        timer.tolerance = 0.2
        RunLoop.main.add(timer, forMode: .common)
        idleTimer = timer
    }

    private func sleep() {
        guard active && !sleeping else { return }
        guard !tray.role.isDisplay else { return }
        sleeping = true
        tray.setSleeping(true)
        curtain.isHidden = false
        controlledScreen?.brightness = 0
        idleTimer?.invalidate()
        idleTimer = nil
        publishPower()
        startSensors()
    }

    @objc private func wake() {
        guard active && sleeping else { return }
        if tray.role.isDisplay { tray.requestWake(); return }
        sleeping = false
        tray.setSleeping(false)
        lastActivity = ProcessInfo.processInfo.systemUptime
        controlledScreen?.brightness = CGFloat(activeBrightness)
        curtain.isHidden = true
        publishPower()
        startSensors()
        startIdleTimer()
    }

    private func stopSensors() {
        sensorGeneration += 1
        motion.stopDeviceMotionUpdates()
        motion.stopAccelerometerUpdates()
    }

    private func startSensors() {
        stopSensors()
        activity.reset()
        guard active, !tray.role.isDisplay else { return }
        let generation = sensorGeneration
        if sleeping {
            guard motion.isAccelerometerAvailable else { reportMotionError(); return }
            // Sleep uses only the accelerometer; gyro fusion and all JS motion
            // delivery stop. Five readings per second bound wake latency.
            motion.accelerometerUpdateInterval = 0.2
            motion.startAccelerometerUpdates(to: .main) { [weak self] sample, error in
                guard let self, self.active, self.sleeping, self.sensorGeneration == generation else { return }
                guard let sample, error == nil else { self.reportMotionError(); return }
                let a = sample.acceleration
                if self.activity.receive(gravity: .init(x: a.x, y: a.y, z: a.z)) { self.wake() }
            }
        } else {
            guard motion.isDeviceMotionAvailable else { reportMotionError(); return }
            motion.deviceMotionUpdateInterval = 1.0 / 30
            motion.startDeviceMotionUpdates(using: .xArbitraryZVertical, to: .main) { [weak self] sample, error in
                guard let self, self.active, !self.sleeping, self.sensorGeneration == generation else { return }
                guard let sample, error == nil else { self.reportMotionError(); return }
                self.motionFailed = false
                let g = sample.gravity, a = sample.userAcceleration, r = sample.rotationRate
                if self.activity.receive(gravity: .init(x: g.x, y: g.y, z: g.z),
                                         acceleration: MotionActivity.Vector(x: a.x, y: a.y, z: a.z).length,
                                         rotation: MotionActivity.Vector(x: r.x, y: r.y, z: r.z).length) {
                    self.lastActivity = ProcessInfo.processInfo.systemUptime
                }
                self.publishMotion(x: g.x, y: g.y)
            }
        }
    }

    private var screenAngle: Int {
        switch view.window?.windowScene?.interfaceOrientation {
        case .landscapeLeft: return 90
        case .landscapeRight: return 270
        case .portraitUpsideDown: return 180
        default: return 0
        }
    }

    private func publishMotion(x: Double, y: Double) {
        guard pageReady, tiltEnabled, !sendingMotion, x.isFinite, y.isFinite else { return }
        sendingMotion = true
        let generation = webGeneration
        // At most one sample in flight: a busy web process cannot build a queue.
        webView.evaluateJavaScript("window.dispatchEvent(new CustomEvent('michas:motion', {detail: {x: \(x), y: \(y), angle: \(screenAngle)}}));") { [weak self] _, _ in
            guard let self, self.webGeneration == generation else { return }
            self.sendingMotion = false
        }
    }

    private func publishPower() {
        guard pageReady else { return }
        let paused = sleeping || !active
        webView.evaluateJavaScript("window.__michasNative.paused = \(paused); window.dispatchEvent(new Event('michas:power'));")
    }

    private func json<T: Encodable>(_ value: T) -> String? {
        guard let data = try? JSONEncoder().encode(value) else { return nil }
        return String(data: data, encoding: .utf8)
    }

    private func publishSync() {
        guard pageReady, let value = json(tray.view) else { return }
        guard !sendingSync else { syncDirty = true; return }
        sendingSync = true
        let generation = webGeneration
        webView.evaluateJavaScript("window.__michasNative.sync = \(value); window.dispatchEvent(new Event('michas:sync'));") { [weak self] _, _ in
            guard let self, self.webGeneration == generation else { return }
            self.sendingSync = false
            if self.syncDirty {
                self.syncDirty = false
                self.publishSync()
            }
        }
    }

    private func applyRemotePower(_ sleeping: Bool) {
        guard active, tray.role.isDisplay, self.sleeping != sleeping else { return }
        self.sleeping = sleeping
        curtain.isHidden = !sleeping
        controlledScreen?.brightness = sleeping ? 0 : CGFloat(activeBrightness)
        publishPower()
    }

    @objc private func showTraySetup() {
        let picker = UIAlertController(title: "Propojení iPadů", message: "\(tray.role.title)\n\(tray.view.message)", preferredStyle: .actionSheet)
        for role in TrayRole.allCases {
            picker.addAction(UIAlertAction(title: role.title, style: .default) { [weak self] _ in self?.chooseTrayCode(role) })
        }
        picker.addAction(UIAlertAction(title: "Zavřít", style: .cancel))
        picker.popoverPresentationController?.sourceView = setupButton
        picker.popoverPresentationController?.sourceRect = setupButton.bounds
        present(picker, animated: true)
    }

    private func chooseTrayCode(_ role: TrayRole) {
        if role == .standalone { configureTray(role: role, code: tray.code); return }
        let prompt = UIAlertController(title: role.title, message: "Zadejte stejný šestimístný kód na všech třech iPadech tohoto tácu. Bluetooth musí být zapnuté.", preferredStyle: .alert)
        prompt.addTextField { field in
            field.keyboardType = .numberPad
            field.text = self.tray.code
            field.placeholder = "Kód tácu · 6 číslic"
        }
        prompt.addAction(UIAlertAction(title: "Zrušit", style: .cancel))
        prompt.addAction(UIAlertAction(title: "Použít", style: .default) { [weak self, weak prompt] _ in
            guard let self, let code = prompt?.textFields?.first?.text, TrayBluetooth.validCode(code) else {
                self?.chooseTrayCode(role); return
            }
            self.configureTray(role: role, code: code)
        })
        present(prompt, animated: true)
    }

    private func configureTray(role: TrayRole, code: String) {
        pageReady = false
        stopSensors()
        tray.configure(role: role, code: code)
        sleeping = false
        motionFailed = false
        sendingMotion = false
        curtain.isHidden = true
        lastActivity = ProcessInfo.processInfo.systemUptime
        if active { controlledScreen?.brightness = CGFloat(activeBrightness) }
        loadWebApp()
        startSensors()
        startIdleTimer()
    }

    private func reportMotionError() {
        motionFailed = true
        stopSensors()
        if pageReady && tiltEnabled { webView.evaluateJavaScript("window.dispatchEvent(new Event('michas:motion-error'));") }
    }

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame,
              let url = message.frameInfo.request.url, isLocal(url),
              let body = message.body as? [String: Any] else { return }
        switch body["command"] as? String {
        case "ready":
            pageReady = true
            tray.setRendererReady(active)
            publishPower()
            publishSync()
            if motionFailed && tiltEnabled { reportMotionError() }
        case "tilt":
            guard !tray.role.isDisplay else { return }
            tiltEnabled = body["enabled"] as? Bool == true
            if motionFailed && tiltEnabled && pageReady { startSensors() }
        case "tray-state":
            guard tray.role == .host, let value = body["state"] as? [String: Any],
                  let data = try? JSONSerialization.data(withJSONObject: value),
                  let telemetry = try? JSONDecoder().decode(TrayTelemetry.self, from: data) else { return }
            tray.update(telemetry)
        default: break
        }
    }

    private func isLocal(_ url: URL) -> Bool {
        url.isFileURL && url.standardizedFileURL.path.hasPrefix(webRoot.standardizedFileURL.path + "/")
    }

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        decisionHandler(action.request.url.map(isLocal) == true && action.targetFrame?.isMainFrame == true ? .allow : .cancel)
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        sendingMotion = false
        loadWebApp()
    }
}
