/**
 * Firebase 시드: 운영자 Auth 계정 + staffAssignments + booths + staffLoginIndex
 *
 * 사용: node scripts/seed-firebase.mjs
 *
 * UI PIN: 0000
 * Firebase Auth 최소 비밀번호(6자) → Auth password 000000
 * 앱에서 PIN 0000 입력 시 padEnd(6,'0') 로 매핑
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const projectId = 'boardgame-a06d1';
const apiKey = 'AIzaSyAVxZ_IxeeIEj2BAtLsxablrJibQEyhWtU';
const AUTH_PASSWORD = '000000';
const PIN = '0000';

const STAFF = [
  { name: '조하나', loginId: '조하나', emailLocal: 'johana' },
  { name: '김선아', loginId: '김선아', emailLocal: 'seona' },
  { name: '박민영', loginId: '박민영', emailLocal: 'minyeong' },
  { name: '오현수', loginId: '오현수', emailLocal: 'hyunsu' },
  { name: '이지수', loginId: '이지수', emailLocal: 'jisu' },
  { name: '황보예린', loginId: '황보예린', emailLocal: 'yerin' },
];

function loadAccessToken() {
  const configPath = path.join(
    process.env.USERPROFILE || process.env.HOME || '',
    '.config',
    'configstore',
    'firebase-tools.json',
  );
  const raw = fs.readFileSync(configPath, 'utf8');
  const json = JSON.parse(raw);
  const token = json?.tokens?.access_token;
  if (!token) {
    throw new Error('Firebase CLI 로그인 토큰이 없습니다.');
  }
  return token;
}

async function identitySignUp(email, password, displayName) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      displayName,
      returnSecureToken: true,
    }),
  });
  const body = await res.json();
  if (!res.ok) {
    if (body?.error?.message === 'EMAIL_EXISTS') {
      return signIn(email, password);
    }
    throw new Error(`signUp ${email}: ${body?.error?.message || res.status}`);
  }
  return body;
}

async function signIn(email, password) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`signIn ${email}: ${body?.error?.message || res.status}`);
  }
  return body;
}

function toFirestoreFields(value) {
  if (value === null || value === undefined) {
    return { nullValue: null };
  }
  if (typeof value === 'string') {
    return { stringValue: value };
  }
  if (typeof value === 'boolean') {
    return { booleanValue: value };
  }
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return { integerValue: String(value) };
    return { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return {
      arrayValue: { values: value.map((item) => toFirestoreFields(item)) },
    };
  }
  if (typeof value === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(value)) {
      fields[k] = toFirestoreFields(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}

async function upsertDocument(accessToken, collection, docId, data) {
  const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
  const fields = {};
  for (const [k, v] of Object.entries(data)) {
    fields[k] = toFirestoreFields(v);
  }

  const getUrl = `${base}/${collection}/${encodeURIComponent(docId)}`;
  const existing = await fetch(getUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (existing.status === 404) {
    const createUrl = `${base}/${collection}?documentId=${encodeURIComponent(docId)}`;
    const res = await fetch(createUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields }),
    });
    if (!res.ok) {
      throw new Error(`create ${collection}/${docId}: ${await res.text()}`);
    }
    return;
  }

  if (!existing.ok) {
    throw new Error(`get ${collection}/${docId}: ${await existing.text()}`);
  }

  const mask = Object.keys(data)
    .map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
    .join('&');
  const patchUrl = `${getUrl}?${mask}`;
  const res = await fetch(patchUrl, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) {
    throw new Error(`patch ${collection}/${docId}: ${await res.text()}`);
  }
}

function sanitizeBooth(booth) {
  return {
    id: booth.id,
    number: booth.number,
    name: booth.name,
    subtitle: booth.subtitle,
    experienceGroup: booth.experienceGroup,
    boothType: booth.boothType,
    description: booth.description,
    location: booth.location,
    target: booth.target,
    groupLabel: booth.groupLabel ?? null,
    durationMinutes: booth.durationMinutes,
    accentColor: booth.accentColor,
    accessCodeConfigured: false,
    capacity: booth.capacity,
    waitlistCapacity: booth.waitlistCapacity,
    status: booth.status,
    staffingType: booth.staffingType,
    activities: booth.activities ?? [],
    slots: booth.slots.map((slot) => ({
      id: slot.id,
      scheduleSlotId: slot.scheduleSlotId,
      startTime: slot.startTime,
      endTime: slot.endTime,
      period: slot.period,
      confirmedCount: 0,
      waitlistCount: 0,
      bookingOpen: true,
    })),
  };
}

async function main() {
  console.log('Loading Firebase access token...');
  const accessToken = loadAccessToken();

  const booths = JSON.parse(
    fs.readFileSync(path.join(root, 'scripts/booths-seed.json'), 'utf8'),
  );
  const allBoothIds = booths.map((b) => b.id);

  console.log(`Seeding ${booths.length} booths...`);
  for (const booth of booths) {
    await upsertDocument(accessToken, 'booths', booth.id, sanitizeBooth(booth));
    console.log(`  booth ${booth.id}`);
  }

  console.log(`Seeding ${STAFF.length} operators (PIN ${PIN})...`);
  for (const person of STAFF) {
    const email = `${person.emailLocal}@boardgame-a06d1.firebaseapp.com`;
    const auth = await identitySignUp(email, AUTH_PASSWORD, person.name);
    const uid = auth.localId;
    console.log(`  auth ${person.name} → ${uid}`);

    await upsertDocument(accessToken, 'staffAssignments', uid, {
      uid,
      name: person.name,
      loginId: person.loginId,
      email,
      role: 'HEAD_ADMIN',
      experienceGroup: null,
      assignedBoothIds: allBoothIds,
      isActive: true,
      pinHint: PIN,
    });

    await upsertDocument(accessToken, 'staffLoginIndex', person.loginId, {
      loginId: person.loginId,
      name: person.name,
      email,
      uid,
    });
  }

  console.log('\nDone. Login with name + PIN 0000');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
