#!/bin/sh
set -eu
test_output=$(mktemp -d "${TMPDIR:-/tmp}/michas-sync.XXXXXX")
trap 'rm -rf "$test_output"' EXIT
xcrun swiftc -module-cache-path "$test_output/cache" native/ios/Michas/TraySyncState.swift tests/ios-sync/main.swift -o "$test_output/check-sync"
"$test_output/check-sync"
