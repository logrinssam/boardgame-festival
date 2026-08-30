/**
 * 예약·현장등록 데이터 초기화 (행사 전 QA 데이터 정리용).
 *
 * 사용:
 *   node scripts/reset-bookings.mjs           # 지울 대상만 보여주고 종료 (기본: 미리보기)
 *   node scripts/reset-bookings.mjs --yes     # 실제로 삭제
 *
 * 하는 일:
 *   1. reservations 컬렉션 전체 삭제
 *   2. walkInRegistrations 컬렉션 전체 삭제
 *   3. 모든 부스 문서의 slots[].confirmedCount / waitlistCount 를 0으로 되돌림
 *      (부스 문서에 캐시된 값이라 예약만 지우면 좌석 수가 어긋난 채 남는다)
 *
 * 부스 이름·회차·현장코드 등 설정값은 건드리지 않는다.
 */
import fs from 'node:fs';
import path from 'node:path';

const projectId = 'boardgame-a06d1';
const apply = process.argv.includes('--yes');

function loadTokens() {
  const configPath = path.join(
    process.env.USERPROFILE || process.env.HOME || '',
    '.config',
    'configstore',
    'firebase-tools.json',
  );
  const json = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  if (!json?.tokens?.access_token) {
    throw new Error('Firebase CLI 토큰이 없습니다. firebase login 후 다시 시도하세요.');
  }
  return json.tokens;
}

async function getAccessToken() {
  const tokens = loadTokens();
  if (tokens.access_token && Date.now() < Number(tokens.expires_at || 0) - 60_000) {
    return tokens.access_token;
  }
  const body = new URLSearchParams({
    client_id:
      '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
    client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
    refresh_token: tokens.refresh_token,
    grant_type: 'refresh_token',
  });
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`토큰 갱신 실패: ${JSON.stringify(json)}`);
  return json.access_token;
}

const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

async function listAll(token, collection) {
  const docs = [];
  let pageToken = '';
  do {
    const url = `${base}/${collection}?pageSize=300${
      pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''
    }`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 404) return docs;
    if (!res.ok) throw new Error(`${collection} 조회 실패: ${await res.text()}`);
    const json = await res.json();
    docs.push(...(json.documents ?? []));
    pageToken = json.nextPageToken ?? '';
  } while (pageToken);
  return docs;
}

async function deleteDoc(token, name) {
  const res = await fetch(`https://firestore.googleapis.com/v1/${name}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`삭제 실패 ${name}: ${await res.text()}`);
}

function fromValue(value) {
  if (!value || typeof value !== 'object') return null;
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('booleanValue' in value) return Boolean(value.booleanValue);
  if ('nullValue' in value) return null;
  if ('mapValue' in value) {
    const out = {};
    for (const [k, v] of Object.entries(value.mapValue.fields ?? {})) {
      out[k] = fromValue(v);
    }
    return out;
  }
  if ('arrayValue' in value) {
    return (value.arrayValue.values ?? []).map(fromValue);
  }
  return null;
}

function toValue(input) {
  if (input === null || input === undefined) return { nullValue: null };
  if (typeof input === 'string') return { stringValue: input };
  if (typeof input === 'boolean') return { booleanValue: input };
  if (typeof input === 'number') {
    return Number.isInteger(input)
      ? { integerValue: String(input) }
      : { doubleValue: input };
  }
  if (Array.isArray(input)) {
    return { arrayValue: { values: input.map(toValue) } };
  }
  const fields = {};
  for (const [k, v] of Object.entries(input)) fields[k] = toValue(v);
  return { mapValue: { fields } };
}

const token = await getAccessToken();

const reservations = await listAll(token, 'reservations');
const walkIns = await listAll(token, 'walkInRegistrations');
const booths = await listAll(token, 'booths');

console.log(`예약(reservations): ${reservations.length}건`);
for (const doc of reservations) {
  const f = doc.fields ?? {};
  console.log(
    `  ${f.boothId?.stringValue} ${f.slotId?.stringValue} | ${f.participantName?.stringValue} | ${f.status?.stringValue}`,
  );
}
console.log(`현장등록(walkInRegistrations): ${walkIns.length}건`);
for (const doc of walkIns) {
  const f = doc.fields ?? {};
  console.log(
    `  ${f.boothId?.stringValue} | ${f.participantName?.stringValue} | ${f.status?.stringValue}`,
  );
}

let dirtyBooths = 0;
for (const doc of booths) {
  const slots = fromValue(doc.fields?.slots) ?? [];
  if (slots.some((s) => Number(s.confirmedCount) || Number(s.waitlistCount))) {
    dirtyBooths += 1;
  }
}
console.log(`좌석 카운터를 되돌릴 부스: ${dirtyBooths}개`);

if (!apply) {
  console.log('\n미리보기입니다. 실제로 지우려면 --yes 를 붙여 다시 실행하세요.');
  process.exit(0);
}

console.log('\n삭제를 시작합니다...');
for (const doc of reservations) {
  await deleteDoc(token, doc.name);
}
console.log(`  예약 ${reservations.length}건 삭제`);
for (const doc of walkIns) {
  await deleteDoc(token, doc.name);
}
console.log(`  현장등록 ${walkIns.length}건 삭제`);

for (const doc of booths) {
  const slots = fromValue(doc.fields?.slots) ?? [];
  if (!slots.some((s) => Number(s.confirmedCount) || Number(s.waitlistCount))) {
    continue;
  }
  const reset = slots.map((slot) => ({
    ...slot,
    confirmedCount: 0,
    waitlistCount: 0,
  }));
  const res = await fetch(`https://firestore.googleapis.com/v1/${doc.name}?updateMask.fieldPaths=slots`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields: { slots: toValue(reset) } }),
  });
  if (!res.ok) throw new Error(`부스 갱신 실패 ${doc.name}: ${await res.text()}`);
  console.log(`  ${doc.name.split('/').pop()} 좌석 카운터 초기화`);
}

console.log('\n완료되었습니다.');
