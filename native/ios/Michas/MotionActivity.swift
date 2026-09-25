import Foundation

// Compares against the last meaningful pose, so a slow lift is not lost by
// comparing only adjacent samples. A static tilted tray eventually sleeps.
struct MotionActivity {
    struct Vector {
        var x: Double
        var y: Double
        var z: Double
        var length: Double { sqrt(x * x + y * y + z * z) }
        func distance(to other: Vector) -> Double {
            Vector(x: x - other.x, y: y - other.y, z: z - other.z).length
        }
    }

    private var reference: Vector?

    mutating func reset() { reference = nil }

    mutating func receive(gravity: Vector, acceleration: Double = 0, rotation: Double = 0) -> Bool {
        guard [gravity.x, gravity.y, gravity.z, acceleration, rotation].allSatisfy({ $0.isFinite }) else { return false }
        guard let previous = reference else { reference = gravity; return false }
        let moved = gravity.distance(to: previous) > 0.025 || acceleration > 0.035 || rotation > 0.10
        if moved { reference = gravity }
        return moved
    }
}

// Sleeping uses raw accelerometer samples at 5 Hz. Require a sustained change
// from the resting pose, not one impulse or an alternating table vibration.
// Keep this separate from the more sensitive detector used during interaction.
struct WakeMotion {
    typealias Vector = MotionActivity.Vector
    private var reference: Vector?
    private var direction: Vector?
    private var startedAt: TimeInterval?
    private var lastSampleAt: TimeInterval?

    mutating func reset(reference: Vector? = nil) {
        self.reference = reference
        direction = nil
        startedAt = nil
        lastSampleAt = nil
    }

    mutating func receive(acceleration: Vector, at time: TimeInterval) -> Bool {
        guard [acceleration.x, acceleration.y, acceleration.z, time].allSatisfy({ $0.isFinite }) else {
            startedAt = nil; lastSampleAt = nil
            return false
        }
        if let lastSampleAt, time <= lastSampleAt || time - lastSampleAt > 0.5 { startedAt = nil }
        lastSampleAt = time
        guard let reference else { self.reference = acceleration; return false }
        let delta = Vector(x: acceleration.x - reference.x, y: acceleration.y - reference.y, z: acceleration.z - reference.z)
        guard delta.length >= 0.08 else { startedAt = nil; return false }
        if let direction, delta.x * direction.x + delta.y * direction.y + delta.z * direction.z <= 0 { startedAt = nil }
        guard let startedAt else {
            self.startedAt = time
            direction = delta
            return false
        }
        return time - startedAt >= 0.6 - 1e-9
    }
}
