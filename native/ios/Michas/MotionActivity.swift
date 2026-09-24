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
