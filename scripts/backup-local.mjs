/**
 * 총괄 PC 백업 — Firestore 참가자 데이터 전체를 이 PC의 backups/ 폴더에 JSON으로 저장한다.
 *
 *   npm run backup:local
 *
 * firebase login(프로젝트 소유자 계정)이 되어 있어야 한다. backups/ 는 git에 올라가지 않는다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { getAccessToken, listDocuments } from './lib/firebaseAdminRest.mjs';

const COLLECTIONS = ['reservations', 'walkInRegistrations', 'operationLogs', 'booths'];

const token = await getAccessToken();
const collections = {};
const counts = {};
for (const name of COLLECTIONS) {
  const docs = await listDocuments(token, name);
  collections[name] = docs
    .map(({ id, data }) => ({ id, ...data }))
    .sort((a, b) => a.id.localeCompare(b.id));
  counts[name] = docs.length;
}

const kst = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString();
const stamp = `${kst.slice(0, 10)}_${kst.slice(11, 19).replace(/:/g, '')}`;
const dir = path.resolve('backups');
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, `participants_${stamp}.json`);
fs.writeFileSync(
  file,
  JSON.stringify({ exportedAt: new Date().toISOString(), trigger: 'local', counts, collections }, null, 1),
);
console.log('저장:', file);
console.log(counts);
