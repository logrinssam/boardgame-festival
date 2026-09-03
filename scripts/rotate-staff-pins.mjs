/**
 * 운영자(본부·부스 팀장) 로그인 PIN 을 전부 무작위 6자리로 교체한다.
 *
 * 배경: 초기 PIN(본부 0000 / 팀장 0808)과 로그인 ID(이름)가 공개 저장소에 있었다.
 *       누구나 본부 관리자로 로그인해 예약자 이름·전화번호를 볼 수 있는 상태였다.
 *
 * 사용:
 *   node scripts/rotate-staff-pins.mjs           # 대상 미리보기
 *   node scripts/rotate-staff-pins.mjs --apply   # 교체 실행, staff-pins.local.csv 저장
 *
 * 새 PIN 은 staff-pins.local.csv 에만 기록된다 (git 에 올라가지 않음).
 * 운영자에게 개별 전달한 뒤 파일은 삭제한다. 앱 로그인은 이름 + 새 PIN 6자리.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  getAccessToken,
  getDocument,
  listDocuments,
  patchDocument,
  randomSixDigits,
  setAuthPassword,
} from './lib/firebaseAdminRest.mjs';

const apply = process.argv.includes('--apply');
const root = path.resolve(import.meta.dirname, '..');

const token = await getAccessToken();
const index = await listDocuments(token, 'staffLoginIndex');

const rows = [];
for (const entry of index) {
  const uid = entry.data.uid ? String(entry.data.uid) : null;
  if (!uid) {
    console.warn(`  ${entry.id}: uid 없음 — 건너뜀`);
    continue;
  }
  const assignment = await getDocument(token, `staffAssignments/${uid}`);
  const role = assignment?.role ?? '?';
  const pin = randomSixDigits();
  rows.push({ loginId: entry.id, name: entry.data.name ?? entry.id, role, uid, pin });

  if (!apply) continue;
  // 6자리는 Firebase Auth 최소 길이를 만족하므로 그대로 비밀번호가 된다
  await setAuthPassword(token, uid, pin);
  // 예전 시드가 남긴 PIN 힌트 제거
  await patchDocument(token, `staffAssignments/${uid}`, {}, ['pinHint']);
  console.log(`  ${entry.id} (${role}) — 교체 완료`);
}

const roleLabel = { HEAD_ADMIN: '본부', GROUP_MANAGER: '영역', BOOTH_STAFF: '팀장' };
console.log(apply ? '\n교체된 운영자:' : '\n대상 운영자 (--apply 를 붙이면 실제 교체):');
for (const row of rows) {
  console.log(`  ${roleLabel[row.role] ?? row.role}  ${row.loginId}`);
}

if (apply) {
  const csvPath = path.join(root, 'staff-pins.local.csv');
  const csv = [
    'loginId,name,role,pin',
    ...rows.map((r) => `"${r.loginId}","${r.name}",${r.role},${r.pin}`),
  ].join('\n');
  fs.writeFileSync(csvPath, `﻿${csv}\n`, 'utf8');
  console.log(`\n새 PIN 목록 저장: ${csvPath}`);
  console.log('→ 운영자에게 개별 전달 후 이 파일을 삭제하세요. 기존 0000/0808 은 더 이상 동작하지 않습니다.');
} else {
  console.log(`\n총 ${rows.length}명. 실행하려면: node scripts/rotate-staff-pins.mjs --apply`);
}
