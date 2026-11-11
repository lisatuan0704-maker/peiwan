#!/bin/sh
# v428 規則測試：先在 127.0.0.1:9000 啟動 Realtime Database Emulator。
# 每一項同時列出「舊規則」與「新規則」的結果，只有新規則的結果決定通過與否。
# 每一批失敗都要讓整體失敗（pipe 不吞掉結束碼）
set -o pipefail 2>/dev/null || true
cd "$(dirname "$0")"
rc=0
OLD=rules-before-v428.json NEW=../../security/database.rules.json
PHASE3=1 node test-phase1.cjs $OLD $NEW || rc=1
OWNER=1 node test-phase2.cjs $OLD $NEW || rc=1
node test-phase3.cjs $OLD $NEW || rc=1
node test-phase4.cjs $OLD $NEW || rc=1
node test-phase5.cjs rules-before-v466.json $NEW || rc=1
node test-phase6.cjs rules-before-v472.json $NEW || rc=1
node test-phase7.cjs rules-before-v475.json $NEW || rc=1
node test-phase8.cjs rules-before-v491.json $NEW || rc=1
node test-phase9.cjs rules-before-v492.json $NEW || rc=1
node test-phase10.cjs rules-before-v493.json $NEW || rc=1
node test-phase11.cjs rules-before-v494.json $NEW || rc=1
node test-phase12.cjs rules-before-v502.json $NEW || rc=1
node test-phase13.cjs rules-before-v503.json $NEW || rc=1
node test-phase14.cjs rules-before-v504.json $NEW || rc=1
node test-phase15.cjs rules-before-v504.json $NEW || rc=1
node test-phase16.cjs rules-before-v505.json $NEW || rc=1
node test-phase17.cjs rules-before-v507.json $NEW || rc=1
node test-phase18.cjs rules-before-v508.json $NEW || rc=1
node test-phase19.cjs rules-before-v510.json $NEW || rc=1
node test-phase20.cjs rules-before-v510.json $NEW || rc=1
node test-phase21.cjs rules-before-v513.json $NEW || rc=1
node test-phase22.cjs rules-before-v522.json $NEW || rc=1

node test-phase23.cjs rules-before-interview1111.json $NEW || rc=1
exit $rc
