#!/bin/sh
# v428 規則測試：先在 127.0.0.1:9000 啟動 Realtime Database Emulator。
# 每一項同時列出「舊規則」與「新規則」的結果，只有新規則的結果決定通過與否。
set -e
cd "$(dirname "$0")"
OLD=rules-before-v428.json NEW=../../security/database.rules.json
PHASE3=1 node test-phase1.cjs $OLD $NEW | tail -1
OWNER=1 node test-phase2.cjs $OLD $NEW | tail -1
node test-phase3.cjs $OLD $NEW | tail -1
