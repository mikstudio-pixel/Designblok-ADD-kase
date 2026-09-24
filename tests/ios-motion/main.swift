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
