import Foundation

enum TrayRole: String, CaseIterable {
    case standalone, host, left, right
    var isDisplay: Bool { self == .left || self == .right }
    var title: String {
        switch self {
        case .standalone: return "Samostatný iPad"
        case .host: return "Prostřední · simulace"
        case .left: return "Levý · hodnoty"
        case .right: return "Pravý · fáze a pokyny"
        }
    }
}

enum TrayPhase: String, Codable, CaseIterable {
    // Wire order is part of protocol version 1.
    case ready, mixing, settling, sleeping, unavailable
}

struct TrayTelemetry: Codable, Equatable {
    var phase: TrayPhase = .unavailable
    var tiltX: Double = 0
    var tiltY: Double = 0
    var activity: Double = 0
    var oil: Double = 0
    var elapsed: Double = 0

    var isValid: Bool {
        [tiltX, tiltY, activity, oil, elapsed].allSatisfy(\.isFinite)
            && (-1...1).contains(tiltX) && (-1...1).contains(tiltY)
            && (0...1).contains(activity) && (0...1).contains(oil)
            && (0...4_294_967).contains(elapsed)
    }
}

struct TrayFrame {
    let session: UInt32
    let sequence: UInt32
    let telemetry: TrayTelemetry

    // Exactly 20 bytes, so even the minimum BLE ATT MTU needs no fragmentation.
    func encoded() -> Data {
        precondition(telemetry.isValid)
        var bytes = [UInt8(1), UInt8(TrayPhase.allCases.firstIndex(of: telemetry.phase)!)]
        func append(_ value: UInt32, count: Int) {
            for shift in 0..<count { bytes.append(UInt8(truncatingIfNeeded: value >> (shift * 8))) }
        }
        append(session, count: 4)
        append(sequence, count: 4)
        append(UInt32(UInt16(bitPattern: Int16((telemetry.tiltX * 1000).rounded()))), count: 2)
        append(UInt32(UInt16(bitPattern: Int16((telemetry.tiltY * 1000).rounded()))), count: 2)
        bytes.append(UInt8((telemetry.activity * 100).rounded()))
        bytes.append(UInt8((telemetry.oil * 100).rounded()))
        append(UInt32((telemetry.elapsed * 1000).rounded()), count: 4)
        return Data(bytes)
    }

    init(session: UInt32, sequence: UInt32, telemetry: TrayTelemetry) {
        self.session = session
        self.sequence = sequence
        self.telemetry = telemetry
    }

    init?(data: Data) {
        let bytes = Array(data)
        guard bytes.count == 20, bytes[0] == 1,
              Int(bytes[1]) < TrayPhase.allCases.count else { return nil }
        func uint(_ offset: Int, _ count: Int) -> UInt32 {
            (0..<count).reduce(0) { $0 | UInt32(bytes[offset + $1]) << ($1 * 8) }
        }
        session = uint(2, 4)
        sequence = uint(6, 4)
        telemetry = TrayTelemetry(
            phase: TrayPhase.allCases[Int(bytes[1])],
            tiltX: Double(Int16(bitPattern: UInt16(uint(10, 2)))) / 1000,
            tiltY: Double(Int16(bitPattern: UInt16(uint(12, 2)))) / 1000,
            activity: Double(bytes[14]) / 100,
            oil: Double(bytes[15]) / 100,
            elapsed: Double(uint(16, 4)) / 1000
        )
        guard telemetry.isValid else { return nil }
    }
}

struct TrayInbox {
    private(set) var frame: TrayFrame?
    private(set) var receivedAt: TimeInterval?

    mutating func receive(_ next: TrayFrame, at now: TimeInterval) -> Bool {
        if let previous = frame, previous.session == next.session {
            let advance = next.sequence &- previous.sequence
            guard advance > 0 && advance < 0x8000_0000 else { return false }
        }
        frame = next
        receivedAt = now
        return true
    }

    func isFresh(at now: TimeInterval) -> Bool {
        guard let receivedAt else { return false }
        return now - receivedAt < 3
    }
}

struct TraySyncView: Encodable {
    let role: String
    let code: String
    let message: String
    let peers: Int
    let telemetry: TrayTelemetry?
}
