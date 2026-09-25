import Foundation

var activity = MotionActivity()
precondition(!activity.receive(gravity: .init(x: 0, y: 0, z: -1)))
for index in 1...20 {
    precondition(!activity.receive(gravity: .init(x: index.isMultiple(of: 2) ? 0.003 : -0.003, y: 0, z: -1)))
}
precondition(!activity.receive(gravity: .init(x: 0.01, y: 0, z: -1)))
precondition(!activity.receive(gravity: .init(x: 0.02, y: 0, z: -1)))
precondition(activity.receive(gravity: .init(x: 0.03, y: 0, z: -1)), "Slow cumulative tilt must wake")
precondition(!activity.receive(gravity: .init(x: 0.03, y: 0, z: -1)), "Holding a tilt must allow sleep")
precondition(activity.receive(gravity: .init(x: 0.03, y: 0, z: -1), acceleration: 0.08))
precondition(activity.receive(gravity: .init(x: 0.03, y: 0, z: -1), rotation: 0.2))
precondition(!activity.receive(gravity: .init(x: .nan, y: 0, z: -1)))
activity.reset()
precondition(!activity.receive(gravity: .init(x: 0.5, y: 0, z: -0.8)))
print("Motion activity checks passed (noise, slow lift, static tilt, translation, rotation, reset).")

let rest = MotionActivity.Vector(x: 0, y: 0, z: -1)
let tilted = MotionActivity.Vector(x: 0.12, y: 0, z: -0.993)
var wake = WakeMotion()
wake.reset(reference: rest)
for index in 0..<450 {
    precondition(!wake.receive(acceleration: .init(x: index.isMultiple(of: 2) ? 0.02 : -0.02, y: 0, z: -1), at: Double(index) * 0.2), "Small vibrations must allow continued sleep")
}

// Include an impulse in the very first low-power sample, before it could
// establish a false baseline; the fused resting pose must survive the impact.
wake.reset(reference: rest)
precondition(!wake.receive(acceleration: .init(x: 0.25, y: 0, z: -1.3), at: 0))
for index in 1...10 {
    precondition(!wake.receive(acceleration: rest, at: Double(index) * 0.2), "One table impact and its return must not wake")
}
wake.reset(reference: rest)
for index in 0..<20 {
    let x = index.isMultiple(of: 2) ? 0.15 : -0.15
    precondition(!wake.receive(acceleration: .init(x: x, y: 0, z: -1), at: Double(index) * 0.2), "Alternating ringing must not count as sustained tilt")
}

// Separate short impulses must not accumulate time towards waking.
wake.reset(reference: rest)
for index in 0..<20 {
    let value = index % 3 == 2 ? rest : tilted
    precondition(!wake.receive(acceleration: value, at: Double(index) * 0.2))
}

wake.reset(reference: rest)
for index in 0..<3 {
    precondition(!wake.receive(acceleration: tilted, at: Double(index) * 0.2), "A short tilt must still be confirmed")
}
precondition(wake.receive(acceleration: tilted, at: 0.6), "A sustained deliberate tilt must wake within four 5 Hz samples")

wake.reset(reference: rest)
for index in 0..<7 {
    precondition(!wake.receive(acceleration: .init(x: Double(index) * 0.02, y: 0, z: -1), at: Double(index) * 0.2))
}
precondition(wake.receive(acceleration: .init(x: 0.14, y: 0, z: -1), at: 1.4), "A slow cumulative lift must still wake")

wake.reset(reference: tilted)
for index in 0..<20 {
    precondition(!wake.receive(acceleration: tilted, at: Double(index) * 0.2), "Sleeping at an angle must not wake spontaneously")
}
wake.reset(reference: rest)
precondition(!wake.receive(acceleration: tilted, at: 0))
precondition(!wake.receive(acceleration: tilted, at: 1), "A delivery gap cannot confirm continuous movement")
precondition(!wake.receive(acceleration: tilted, at: 1.2))
precondition(!wake.receive(acceleration: tilted, at: 1.4))
precondition(wake.receive(acceleration: tilted, at: 1.6))
wake.reset(reference: rest)
precondition(!wake.receive(acceleration: tilted, at: 0))
precondition(!wake.receive(acceleration: .init(x: .nan, y: 0, z: -1), at: 0.2))
precondition(!wake.receive(acceleration: tilted, at: 0.4))
precondition(!wake.receive(acceleration: tilted, at: 0.6), "Invalid samples must interrupt confirmation")
wake.reset()
precondition(!wake.receive(acceleration: tilted, at: 0), "Without a fused pose the first sample only establishes a baseline")
precondition(!wake.receive(acceleration: tilted, at: 0.2))
print("Wake filtering checks passed (rest, impulses, ringing, sustained/slow tilt, tilted rest, sample gaps, reset).")
