import CoreBluetooth
import Foundation

// All Core Bluetooth callbacks and web messages run on the main queue.
final class TrayBluetooth: NSObject, CBPeripheralManagerDelegate, CBCentralManagerDelegate, CBPeripheralDelegate {
    private(set) var role: TrayRole
    private(set) var code: String
    private(set) var preview: Bool
    var onChange: ((TraySyncView) -> Void)?
    var onRemotePower: ((Bool) -> Void)?
    var onWake: (() -> Void)?

    private let defaults: UserDefaults
    private let stateID = CBUUID(string: "840CD0EA-F56C-46EF-9100-1072B4B00001")
    private let wakeID = CBUUID(string: "840CD0EA-F56C-46EF-9100-1072B4B00002")
    private var serviceID: CBUUID { CBUUID(string: "840CD0EA-F56C-46EF-9200-000000\(code)") }
    private var pinnedHost: String? { defaults.string(forKey: "tray.host.\(code)") }
    private var active = false
    private var peripheralManager: CBPeripheralManager?
    private var centralManager: CBCentralManager?
    private var stateCharacteristic: CBMutableCharacteristic?
    private var remote: CBPeripheral?
    private var retiring: CBPeripheral?
    private var remoteWake: CBCharacteristic?
    private var subscribers: [UUID: CBCentral] = [:]
    private var pending: [UUID: Data] = [:]
    private var timer: Timer?
    private var session = UInt32.random(in: 1...UInt32.max)
    private var sequence: UInt32 = 0
    private var local = TrayTelemetry()
    private var gyro: GyroAngles?
    private var motionActivity: Double = 0
    private var motionUpdatedAt: TimeInterval?
    private var webUpdatedAt: TimeInterval?
    private var rendererReady = false
    private var sleeping = false
    private var lastSentAt: TimeInterval = 0
    private var connectingAt: TimeInterval?
    private var inbox = TrayInbox()
    private var message = "Samostatný provoz"
    private var now: TimeInterval { ProcessInfo.processInfo.systemUptime }

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        role = TrayRole(rawValue: defaults.string(forKey: "tray.role") ?? "") ?? .standalone
        let stored = defaults.string(forKey: "tray.code") ?? "100001"
        code = Self.validCode(stored) ? stored : "100001"
        preview = defaults.bool(forKey: "tray.preview")
        super.init()
    }

    static func validCode(_ value: String) -> Bool {
        value.utf8.count == 6 && value.utf8.allSatisfy { (48...57).contains($0) }
    }

    var view: TraySyncView {
        TraySyncView(role: role.rawValue, code: code, preview: preview, message: message,
                     peers: role == .host ? subscribers.count : (inbox.isFresh(at: now) ? 1 : 0),
                     telemetry: role.isDisplay && inbox.isFresh(at: now) ? inbox.frame?.telemetry : nil)
    }

    func configure(role: TrayRole, code: String, preview: Bool = false) {
        guard Self.validCode(code) else { return }
        let wasActive = active
        setActive(false)
        self.role = role
        self.code = code
        self.preview = preview
        defaults.set(role.rawValue, forKey: "tray.role")
        defaults.set(code, forKey: "tray.code")
        defaults.set(preview, forKey: "tray.preview")
        // Explicit setup also permits replacing the central iPad.
        defaults.removeObject(forKey: "tray.host.\(code)")
        local = TrayTelemetry()
        gyro = nil
        motionUpdatedAt = nil
        rendererReady = false
        sleeping = false
        webUpdatedAt = nil
        setActive(wasActive)
        changed()
    }

    func setActive(_ value: Bool) {
        guard active != value else { return }
        active = value
        if !value {
            timer?.invalidate()
            timer = nil
            centralManager?.stopScan()
            if let remote { centralManager?.cancelPeripheralConnection(remote) }
            remote?.delegate = nil
            centralManager?.delegate = nil
            peripheralManager?.stopAdvertising()
            peripheralManager?.removeAllServices()
            peripheralManager?.delegate = nil
            centralManager = nil
            peripheralManager = nil
            stateCharacteristic = nil
            remote = nil
            retiring = nil
            remoteWake = nil
            subscribers.removeAll()
            pending.removeAll()
            inbox = TrayInbox()
            connectingAt = nil
            message = "Propojení je pozastavené"
            changed()
            return
        }
        guard role != .standalone else { message = "Samostatný provoz"; changed(); return }
        guard !preview else { message = "Vizuální test bez propojení"; changed(); return }
        message = "Připravuji Bluetooth…"
        if role == .host {
            session = UInt32.random(in: 1...UInt32.max)
            sequence = 0
            peripheralManager = CBPeripheralManager(delegate: self, queue: .main)
        } else {
            centralManager = CBCentralManager(delegate: self, queue: .main)
        }
        let pulse = Timer(timeInterval: 1, repeats: true) { [weak self] _ in self?.tick() }
        pulse.tolerance = 0.15
        RunLoop.main.add(pulse, forMode: .common)
        timer = pulse
        changed()
    }

    func setRendererReady(_ ready: Bool) {
        rendererReady = ready
        if !ready { webUpdatedAt = nil }
        broadcast()
    }

    func setSleeping(_ sleeping: Bool) {
        self.sleeping = sleeping
        if !sleeping { webUpdatedAt = nil } // Wait for a fresh web state after wake.
        broadcast()
    }

    func update(_ telemetry: TrayTelemetry) {
        guard role == .host, telemetry.isValid,
              telemetry.phase != .sleeping else { return }
        local = telemetry
        webUpdatedAt = now
        broadcast()
    }

    func updateMotion(gyro: GyroAngles, activity: Double) {
        guard gyro.isValid, activity.isFinite, (0...1).contains(activity) else { return }
        self.gyro = gyro
        motionActivity = activity
        motionUpdatedAt = now
    }

    func requestWake() {
        guard role.isDisplay, let remote, let remoteWake, remote.state == .connected else { return }
        remote.writeValue(Data([1]), for: remoteWake, type: .withResponse)
    }

    private func changed() { onChange?(view) }

    private func radioMessage(_ state: CBManagerState) -> String {
        switch state {
        case .poweredOff: return "Zapněte Bluetooth v Nastavení iPadu."
        case .unauthorized: return "Povolte aplikaci Bluetooth v Nastavení iPadu."
        case .unsupported: return "Toto zařízení nepodporuje Bluetooth LE."
        default: return "Čekám na Bluetooth…"
        }
    }

    private func tick() {
        guard active else { return }
        if role == .host {
            // In sleep only this one-second heartbeat runs; no web polling.
            if now - lastSentAt >= 0.9 { broadcast() }
        } else if role.isDisplay {
            // Initial encryption can show a system pairing dialog on both iPads.
            if let started = connectingAt, now - started >= 60 { disconnect("Spojení se nezdařilo, zkouším znovu…") }
            else if inbox.frame != nil && !inbox.isFresh(at: now) { disconnect("Spojení přerušeno, hledám prostřední iPad…") }
            else if remote == nil { search() }
        }
    }

    private func packet() -> Data {
        var telemetry = local
        if sleeping { telemetry.phase = .sleeping }
        else if !rendererReady || webUpdatedAt.map({ now - $0 > 2 }) != false { telemetry.phase = .unavailable }
        if !sleeping, rendererReady, motionUpdatedAt.map({ now - $0 < 1 }) == true {
            telemetry.gyro = gyro
            telemetry.activity = motionActivity
        }
        sequence &+= 1
        return TrayFrame(session: session, sequence: sequence, telemetry: telemetry).encoded()
    }

    private func broadcast() {
        guard active, role == .host, peripheralManager?.state == .poweredOn else { return }
        lastSentAt = now
        let data = packet()
        // Keep only the newest unsent snapshot per display; never replay a backlog.
        for id in subscribers.keys { pending[id] = data }
        flush()
    }

    private func flush() {
        guard let manager = peripheralManager, let characteristic = stateCharacteristic else { return }
        for id in Array(pending.keys) {
            guard let central = subscribers[id], let data = pending[id] else { pending[id] = nil; continue }
            guard manager.updateValue(data, for: characteristic, onSubscribedCentrals: [central]) else { return }
            pending[id] = nil
        }
    }

    private func advertise() {
        guard let manager = peripheralManager, manager.state == .poweredOn, stateCharacteristic != nil else { return }
        if subscribers.count >= 2 { manager.stopAdvertising() }
        else if !manager.isAdvertising { manager.startAdvertising([CBAdvertisementDataServiceUUIDsKey: [serviceID]]) }
    }

    func peripheralManagerDidUpdateState(_ peripheral: CBPeripheralManager) {
        guard peripheral === peripheralManager, active else { return }
        subscribers.removeAll()
        pending.removeAll()
        stateCharacteristic = nil
        guard peripheral.state == .poweredOn else { message = radioMessage(peripheral.state); changed(); return }
        peripheral.removeAllServices()
        let state = CBMutableCharacteristic(type: stateID, properties: [.read, .notify, .notifyEncryptionRequired],
                                            value: nil, permissions: [.readable, .readEncryptionRequired])
        let wake = CBMutableCharacteristic(type: wakeID, properties: [.write],
                                           value: nil, permissions: [.writeable, .writeEncryptionRequired])
        let service = CBMutableService(type: serviceID, primary: true)
        service.characteristics = [state, wake]
        peripheral.add(service)
        message = "Připravuji propojení tácu \(code)…"
        changed()
    }

    func peripheralManager(_ peripheral: CBPeripheralManager, didAdd service: CBService, error: Error?) {
        guard peripheral === peripheralManager, active else { return }
        guard error == nil, let state = service.characteristics?.first(where: { $0.uuid == stateID }) as? CBMutableCharacteristic else {
            message = "Bluetooth službu se nepodařilo spustit. Otevřete znovu nastavení iPadů."
            changed(); return
        }
        stateCharacteristic = state
        message = "Čekám na boční iPady · tác \(code)"
        advertise()
        changed()
    }

    func peripheralManagerDidStartAdvertising(_ peripheral: CBPeripheralManager, error: Error?) {
        guard peripheral === peripheralManager, error != nil else { return }
        message = "Vyhledání iPadu se nepodařilo zapnout. Otevřete znovu nastavení iPadů."
        changed()
    }

    func peripheralManager(_ peripheral: CBPeripheralManager, central: CBCentral, didSubscribeTo characteristic: CBCharacteristic) {
        guard peripheral === peripheralManager, characteristic.uuid == stateID else { return }
        subscribers[central.identifier] = central
        message = "Připojené displeje: \(subscribers.count)/2 · tác \(code)"
        broadcast()
        advertise()
        changed()
    }

    func peripheralManager(_ peripheral: CBPeripheralManager, central: CBCentral, didUnsubscribeFrom characteristic: CBCharacteristic) {
        guard peripheral === peripheralManager, characteristic.uuid == stateID else { return }
        subscribers[central.identifier] = nil
        pending[central.identifier] = nil
        message = "Připojené displeje: \(subscribers.count)/2 · tác \(code)"
        advertise()
        changed()
    }

    func peripheralManagerIsReady(toUpdateSubscribers peripheral: CBPeripheralManager) {
        if peripheral === peripheralManager { flush() }
    }

    func peripheralManager(_ peripheral: CBPeripheralManager, didReceiveRead request: CBATTRequest) {
        guard peripheral === peripheralManager else { return }
        guard request.characteristic.uuid == stateID else { peripheral.respond(to: request, withResult: .attributeNotFound); return }
        let data = packet()
        guard request.offset <= data.count else { peripheral.respond(to: request, withResult: .invalidOffset); return }
        request.value = data.subdata(in: request.offset..<data.count)
        peripheral.respond(to: request, withResult: .success)
    }

    func peripheralManager(_ peripheral: CBPeripheralManager, didReceiveWrite requests: [CBATTRequest]) {
        guard peripheral === peripheralManager, let first = requests.first else { return }
        guard requests.allSatisfy({ $0.characteristic.uuid == wakeID && $0.offset == 0 && $0.value == Data([1]) }) else {
            peripheral.respond(to: first, withResult: .requestNotSupported); return
        }
        onWake?()
        peripheral.respond(to: first, withResult: .success)
    }

    func centralManagerDidUpdateState(_ central: CBCentralManager) {
        guard central === centralManager, active else { return }
        if central.state == .poweredOn { search() }
        else {
            remote?.delegate = nil
            remote = nil
            retiring = nil
            remoteWake = nil
            connectingAt = nil
            inbox = TrayInbox()
            message = radioMessage(central.state)
            onRemotePower?(false)
            changed()
        }
    }

    private func search() {
        guard active, role.isDisplay, remote == nil, retiring == nil, let manager = centralManager,
              manager.state == .poweredOn, !manager.isScanning else { return }
        message = "Hledám prostřední iPad · tác \(code)"
        manager.scanForPeripherals(withServices: [serviceID])
        changed()
    }

    func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral,
                        advertisementData: [String: Any], rssi RSSI: NSNumber) {
        guard central === centralManager, remote == nil, retiring == nil, central.isScanning,
              pinnedHost == nil || pinnedHost == peripheral.identifier.uuidString else { return }
        central.stopScan()
        remote = peripheral
        peripheral.delegate = self
        connectingAt = now
        message = "Připojuji prostřední iPad…"
        central.connect(peripheral)
        changed()
    }

    func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        guard central === centralManager, peripheral === remote else { return }
        peripheral.discoverServices([serviceID])
    }

    func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        guard peripheral === remote else { return }
        guard error == nil, let service = peripheral.services?.first(where: { $0.uuid == serviceID }) else {
            disconnect("Prostřední iPad neposkytuje službu tohoto tácu."); return
        }
        peripheral.discoverCharacteristics([stateID, wakeID], for: service)
    }

    func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
        guard peripheral === remote else { return }
        guard error == nil, let state = service.characteristics?.first(where: { $0.uuid == stateID }),
              let wake = service.characteristics?.first(where: { $0.uuid == wakeID }) else {
            disconnect("Propojení má nekompatibilní verzi aplikace."); return
        }
        remoteWake = wake
        peripheral.setNotifyValue(true, for: state)
    }

    func peripheral(_ peripheral: CBPeripheral, didUpdateNotificationStateFor characteristic: CBCharacteristic, error: Error?) {
        guard peripheral === remote, characteristic.uuid == stateID else { return }
        guard error == nil, characteristic.isNotifying else { disconnect("Přenos dat nebyl povolen. Zkontrolujte párování Bluetooth."); return }
        peripheral.readValue(for: characteristic)
    }

    func peripheral(_ peripheral: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic, error: Error?) {
        guard peripheral === remote, characteristic.uuid == stateID else { return }
        guard error == nil, let data = characteristic.value, let frame = TrayFrame(data: data) else {
            disconnect("Přijatá data nejsou platná. Zkontrolujte verzi aplikace."); return
        }
        guard inbox.receive(frame, at: now) else { return }
        connectingAt = nil
        if pinnedHost != peripheral.identifier.uuidString {
            defaults.set(peripheral.identifier.uuidString, forKey: "tray.host.\(code)")
        }
        message = "Propojeno · tác \(code)"
        onRemotePower?(frame.telemetry.phase == .sleeping)
        changed()
    }

    func peripheral(_ peripheral: CBPeripheral, didWriteValueFor characteristic: CBCharacteristic, error: Error?) {
        guard peripheral === remote, error != nil else { return }
        disconnect("Probuzení se nepodařilo odeslat, obnovuji spojení…")
    }

    func peripheral(_ peripheral: CBPeripheral, didModifyServices invalidatedServices: [CBService]) {
        if peripheral === remote { disconnect("Prostřední iPad se restartuje, obnovuji spojení…") }
    }

    private func disconnect(_ reason: String) {
        if let remote {
            remote.delegate = nil
            if remote.state != .disconnected {
                retiring = remote
                centralManager?.cancelPeripheralConnection(remote)
            }
        }
        remote = nil
        remoteWake = nil
        connectingAt = nil
        inbox = TrayInbox()
        message = reason
        onRemotePower?(false)
        changed()
    }

    func centralManager(_ central: CBCentralManager, didFailToConnect peripheral: CBPeripheral, error: Error?) {
        guard central === centralManager else { return }
        if peripheral === retiring { retiring = nil }
        else if peripheral === remote { disconnect("Spojení se nezdařilo, zkouším znovu…") }
    }

    func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, error: Error?) {
        guard central === centralManager else { return }
        if peripheral === retiring { retiring = nil }
        else if peripheral === remote { disconnect("Spojení přerušeno, hledám prostřední iPad…") }
    }
}
