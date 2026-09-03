/**
 * 부스 현장코드를 공개 문서(booths.accessCode)에서 운영자 전용 문서(boothSecrets)로 옮긴다.
 *
 * 배경: booths 컬렉션은 참가자 앱이 읽어야 해서 누구나 읽을 수 있다.
 *       현장코드가 그 문서에 평문으로 있으면 부스에 안 가고도 예약할 수 있다.
 *
 * 사용:
 *   node scripts/migrate-access-codes.mjs                  # 미리보기 (변경 없음)
 *   node scripts/migrate-access-codes.mjs --apply          # 기존 코드를 그대로 boothSecrets 로 이동
 *   node scripts/migrate-access-codes.mjs --apply --rotate # 새 6자리 코드로 전부 교체 (유출 대응)
 *
 * --rotate 결과는 access-codes.local.csv 에 저장된다 (git 에 올라가지 않음).
 * 안내판을 다시 인쇄해야 하므로 행사 전 여유 있게 실행한다.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  getAccessToken,
  getDocument,
  listDocuments,
  patchDocument,
  randomSixDigits,
} from './lib/firebaseAdminRest.mjs';

const apply = process.argv.includes('--apply');
const rotate = process.argv.includes('--rotate');
const root = path.resolve(import.meta.dirname, '..');

const token = await getAccessToken();
const booths = (await listDocuments(token, 'booths')).sort(
  (a, b) => Number(a.data.number) - Number(b.data.number),
);

const rows = [];
for (const booth of booths) {
  const publicCode = booth.data.accessCode ? String(booth.data.accessCode) : null;
  const secret = await getDocument(token, `boothSecrets/${booth.id}`);
  const secretCode = secret?.accessCode ? String(secret.accessCode) : null;

  let nextCode;
  let action;
  if (rotate) {
    nextCode = randomSixDigits();
    action = '새 코드로 교체';
  } else if (secretCode) {
    nextCode = secretCode;
    action = publicCode ? '공개 문서에서 제거만' : '변경 없음';
  } else if (publicCode) {
    nextCode = publicCode;
    action = 'boothSecrets 로 이동';
  } else {
    nextCode = null;
    action = '코드 없음 — 건너뜀';
  }

  rows.push({
    id: booth.id,
    number: booth.data.number,
    name: booth.data.name,
    code: nextCode,
    action,
  });

  if (!apply || !nextCode) continue;

  await patchDocument(token, `boothSecrets/${booth.id}`, {
    accessCode: nextCode,
    updatedAt: new Date().toISOString(),
    updatedBy: 'migrate-access-codes',
  });
  await patchDocument(
    token,
    `booths/${booth.id}`,
    { accessCodeConfigured: true },
    ['accessCode'],
  );
}

console.log(apply ? '\n적용 결과:' : '\n미리보기 (--apply 를 붙이면 실제 반영):');
console.log('번호  부스                         현장코드  작업');
for (const row of rows) {
  console.log(
    `${String(row.number).padStart(2)}    ${String(row.name).padEnd(24)} ${row.code ?? '-'}    ${row.action}`,
  );
}

if (apply && rotate) {
  const csvPath = path.join(root, 'access-codes.local.csv');
  const csv = ['number,name,accessCode', ...rows.map((r) => `${r.number},"${r.name}",${r.code ?? ''}`)].join('\n');
  fs.writeFileSync(csvPath, `﻿${csv}\n`, 'utf8');
  console.log(`\n새 현장코드 목록 저장: ${csvPath}`);
  console.log('→ 안내판을 다시 인쇄하고, 이 파일은 공유 후 삭제하세요.');
}
if (apply) {
  console.log('\n운영 앱 > 부스 관리(관리자) / 부스 운영 화면(팀장)에서도 현재 코드를 볼 수 있습니다.');
}
