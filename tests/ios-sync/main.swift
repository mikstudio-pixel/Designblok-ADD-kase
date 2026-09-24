import Foundation

func require(_ condition: @autoclosure () -> Bool, _ message: String) {
    precondition(condition(), message)
}

let telemetry = TrayTelemetry(phase: .mixing, tiltX: -1, tiltY: 0.375, activity: 0.62, oil: 0.25, elapsed: 42.125)
let frame = TrayFrame(session: 0x12345678, sequence: 0x04030201, telemetry: telemetry)
let data = frame.encoded()
require(data.count == 20, "Snapshots must fit a minimum ATT notification")
require(Array(data) == [1, 1, 0x78, 0x56, 0x34, 0x12, 1, 2, 3, 4, 0x18, 0xfc, 0x77, 1, 62, 25, 0x8d, 0xa4, 0, 0], "Protocol fixture: little endian, signed tilt, milliseconds")
require(TrayFrame(data: data)?.telemetry == telemetry, "A decoded state must match the transmitted state")
require(TrayFrame(data: data)?.session == frame.session, "Session survives encoding")
require(TrayFrame(data: data)?.sequence == frame.sequence, "Sequence survives encoding")

for phase in TrayPhase.allCases {
    let state = TrayTelemetry(phase: phase, tiltX: 1, tiltY: -1, activity: 1, oil: 0, elapsed: 0)
    require(TrayFrame(data: TrayFrame(session: 1, sequence: 0, telemetry: state).encoded())?.telemetry == state, "All phases and endpoints round trip")
}
for count in [0, 1, 19, 21, 100] {
    require(TrayFrame(data: Data(repeating: 0, count: count)) == nil, "Reject truncated/oversize messages")
}
for (offset, value) in [(0, UInt8(2)), (1, 255), (11, 0x7f), (14, 101), (15, 255)] {
    var corrupt = data
    corrupt[offset] = value
    require(TrayFrame(data: corrupt) == nil, "Reject incompatible versions, phases, and invalid metrics")
}
var invalid = telemetry
invalid.tiltX = .nan
require(!invalid.isValid, "NaN from the web must not reach integer conversion")
invalid = telemetry
invalid.elapsed = .infinity
require(!invalid.isValid, "Infinite elapsed time must be rejected")
invalid.elapsed = -1
require(!invalid.isValid, "Negative elapsed time must be rejected")
invalid.elapsed = 4_294_968
require(!invalid.isValid, "Elapsed milliseconds must fit UInt32")

var inbox = TrayInbox()
require(!inbox.isFresh(at: 10), "No metrics before the first valid snapshot")
require(inbox.receive(frame, at: 10), "First snapshot is accepted")
require(inbox.isFresh(at: 12.99), "Heartbeat remains fresh inside the timeout")
require(!inbox.receive(frame, at: 12), "Duplicates must not refresh the timeout")
require(!inbox.isFresh(at: 13), "Stale values are hidden after three seconds")
require(!inbox.receive(TrayFrame(session: frame.session, sequence: frame.sequence - 1, telemetry: telemetry), at: 13), "An older snapshot cannot roll the UI back")
require(inbox.receive(TrayFrame(session: frame.session, sequence: frame.sequence + 1, telemetry: telemetry), at: 14), "Next snapshot restores freshness")
require(inbox.isFresh(at: 14), "Recovery shows current state")
require(inbox.receive(TrayFrame(session: 99, sequence: UInt32.max, telemetry: telemetry), at: 15), "Host restart accepts a new session")
require(inbox.receive(TrayFrame(session: 99, sequence: 0, telemetry: telemetry), at: 16), "Sequence rollover is accepted")
require(!inbox.receive(TrayFrame(session: 99, sequence: UInt32.max, telemetry: telemetry), at: 17), "Old values across rollover are rejected")
inbox = TrayInbox()
require(!inbox.isFresh(at: 17), "Disconnect clears the current state")
require(TrayRole.left.isDisplay && TrayRole.right.isDisplay, "Both side roles are displays")
require(!TrayRole.host.isDisplay && !TrayRole.standalone.isDisplay, "Only simulation roles may run sensors")
print("Tray sync checks passed (wire fixture, bounds, all phases, stale data, ordering, restart, rollover).")
