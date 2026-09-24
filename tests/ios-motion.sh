#!/bin/sh
set -eu
test_output=$(mktemp -d "${TMPDIR:-/tmp}/michas-motion.XXXXXX")
trap 'rm -rf "$test_output"' EXIT
xcrun swiftc -module-cache-path "$test_output/cache" native/ios/Michas/MotionActivity.swift tests/ios-motion/main.swift -o "$test_output/check-motion"
"$test_output/check-motion"
