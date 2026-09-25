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
    private var wakeActivity = WakeMotion()
    private var idleTimer: Timer?
    private var dimmingTimer: Timer?
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
    private let benchmarking = ProcessInfo.processInfo.arguments.contains("--fluid-benchmark")

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
            source: "window.__michasNative = {paused: \(sleeping || !active), sync: \(sync), benchmark: \(benchmarking)};",
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
        updateDisplay()
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
        stopDimming()
        curtain.backgroundColor = .black
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
        guard !tray.role.isDisplay, !benchmarking else { return }
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
        updateDisplay()
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
        updateDisplay()
        publishPower()
        startSensors()
        startIdleTimer()
    }

    private func stopDimming() {
        dimmingTimer?.invalidate()
        dimmingTimer = nil
    }

    private func updateDisplay() {
        stopDimming()
        curtain.isHidden = !sleeping
        guard sleeping else {
            curtain.backgroundColor = .black
            controlledScreen?.brightness = CGFloat(activeBrightness)
            return
        }
        // Fade the black cover as well as the actual backlight. Keep the view
        // opaque to hit testing so a wake touch never reaches a control below.
        curtain.backgroundColor = .clear
        let initialBrightness = controlledScreen?.brightness ?? CGFloat(activeBrightness)
        let startedAt = ProcessInfo.processInfo.systemUptime
        let timer = Timer(timeInterval: 1.0 / 30, repeats: true) { [weak self] timer in
            guard let self, self.active, self.sleeping else { timer.invalidate(); return }
            let progress = min(1, (ProcessInfo.processInfo.systemUptime - startedAt) / 2)
            let eased = CGFloat(progress * progress * (3 - 2 * progress))
            self.controlledScreen?.brightness = initialBrightness * (1 - eased)
            self.curtain.backgroundColor = UIColor(white: 0, alpha: eased)
            if progress >= 1 { self.stopDimming() }
        }
        RunLoop.main.add(timer, forMode: .common)
        dimmingTimer = timer
    }

    private func stopSensors() {
        sensorGeneration += 1
        motion.stopDeviceMotionUpdates()
        motion.stopAccelerometerUpdates()
    }

    private func startSensors() {
        let restingGravity = motion.deviceMotion?.gravity
        stopSensors()
        activity.reset()
        // Use the fused gravity before stopping it: an impulse in the first
        // low-power sample must not become the new resting pose.
        wakeActivity.reset(reference: restingGravity.map { .init(x: $0.x, y: $0.y, z: $0.z) })
        guard active else { return }
        let generation = sensorGeneration
        if sleeping {
            guard motion.isAccelerometerAvailable else { reportMotionError(); return }
            // Sleep uses only the accelerometer; gyro fusion and all JS motion
            // delivery stop. Four consistent samples confirm intentional motion.
            motion.accelerometerUpdateInterval = 0.2
            motion.startAccelerometerUpdates(to: .main) { [weak self] sample, error in
                guard let self, self.active, self.sleeping, self.sensorGeneration == generation else { return }
                guard let sample, error == nil else { self.reportMotionError(); return }
                let a = sample.acceleration
                if self.wakeActivity.receive(acceleration: .init(x: a.x, y: a.y, z: a.z), at: sample.timestamp) { self.wake() }
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
                let gyro = GyroAngles(x: sample.attitude.roll * 180 / .pi,
                                      y: sample.attitude.pitch * 180 / .pi,
                                      z: sample.attitude.yaw * 180 / .pi)
                let strength = min(1, max(MotionActivity.Vector(x: a.x, y: a.y, z: a.z).length / 0.12,
                                          MotionActivity.Vector(x: r.x, y: r.y, z: r.z).length / 0.8))
                self.tray.updateMotion(gyro: gyro, activity: strength)
                self.publishMotion(x: g.x, y: g.y, gyro: gyro, activity: strength)
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

    private func publishMotion(x: Double, y: Double, gyro: GyroAngles, activity: Double) {
        guard pageReady, tiltEnabled, !sendingMotion, x.isFinite, y.isFinite, gyro.isValid, activity.isFinite else { return }
        sendingMotion = true
        let generation = webGeneration
        // At most one sample in flight: a busy web process cannot build a queue.
        webView.evaluateJavaScript("window.dispatchEvent(new CustomEvent('michas:motion', {detail: {x: \(x), y: \(y), angle: \(screenAngle), gyro: {x: \(gyro.x), y: \(gyro.y), z: \(gyro.z)}, activity: \(activity)}}));") { [weak self] _, _ in
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
        updateDisplay()
        publishPower()
        startSensors()
    }

    @objc private func showTraySetup() {
        let picker = UIAlertController(title: "Propojení iPadů", message: "\(tray.role.title)\n\(tray.view.message)", preferredStyle: .actionSheet)
        for role in TrayRole.allCases {
            picker.addAction(UIAlertAction(title: role.title, style: .default) { [weak self] _ in self?.chooseTrayCode(role) })
        }
        if tray.role.isDisplay {
            picker.addAction(UIAlertAction(title: "Kalibrace displeje · X / Y / velikost", style: .default) { [weak self] _ in
                self?.webView.evaluateJavaScript("window.dispatchEvent(new Event('michas:calibrate'));")
            })
        }
        picker.addAction(UIAlertAction(title: "Zavřít", style: .cancel))
        picker.popoverPresentationController?.sourceView = setupButton
        picker.popoverPresentationController?.sourceRect = setupButton.bounds
        present(picker, animated: true)
    }

    private func chooseTrayCode(_ role: TrayRole) {
        if role == .standalone { configureTray(role: role, code: tray.code); return }
        let prompt = UIAlertController(title: role.title, message: "Pro propojení zadejte stejný šestimístný kód na všech třech iPadech. Bez aktuálních dat z prostředního iPadu používá boční displej vlastní gyroskop. Spustit jej lze i bez Bluetooth a bez kódu.", preferredStyle: .alert)
        prompt.addTextField { field in
            field.keyboardType = .numberPad
            field.text = self.tray.code
            field.placeholder = "Kód tácu · 6 číslic"
        }
        prompt.addAction(UIAlertAction(title: "Zrušit", style: .cancel))
        prompt.addAction(UIAlertAction(title: "Spustit bez propojení", style: .default) { [weak self] _ in
            guard let self else { return }
            self.configureTray(role: role, code: self.tray.code, preview: true)
        })
        prompt.addAction(UIAlertAction(title: "Propojit přes Bluetooth", style: .default) { [weak self, weak prompt] _ in
            guard let self, let code = prompt?.textFields?.first?.text, TrayBluetooth.validCode(code) else {
                self?.chooseTrayCode(role); return
            }
            self.configureTray(role: role, code: code)
        })
        present(prompt, animated: true)
    }

    private func configureTray(role: TrayRole, code: String, preview: Bool = false) {
        pageReady = false
        stopSensors()
        tray.configure(role: role, code: code, preview: preview)
        sleeping = false
        motionFailed = false
        sendingMotion = false
        lastActivity = ProcessInfo.processInfo.systemUptime
        if active { updateDisplay() }
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
        case "benchmark-result":
            guard benchmarking, let result = body["result"], JSONSerialization.isValidJSONObject(result),
                  let data = try? JSONSerialization.data(withJSONObject: result, options: [.prettyPrinted]),
                  let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first else { return }
            try? data.write(to: documents.appendingPathComponent("fluid-benchmark.json"), options: .atomic)
        case "ready":
            pageReady = true
            tray.setRendererReady(active)
            publishPower()
            publishSync()
            if motionFailed && tiltEnabled { reportMotionError() }
        case "tilt":
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
