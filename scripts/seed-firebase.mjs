/**
 * Firebase 시드: 운영자 Auth 계정 + staffAssignments + booths + staffLoginIndex
 *
 * 사용: node scripts/seed-firebase.mjs
 *
 * 본부 PIN: 0000 → Auth 000000
 * 부스 팀장 PIN: 0808 → Auth 080800
 * 앱에서 PIN 입력 시 padEnd(6,'0') 로 매핑
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const projectId = 'boardgame-a06d1';
const apiKey = 'AIzaSyAVxZ_IxeeIEj2BAtLsxablrJibQEyhWtU';

function pinToAuthPassword(pin) {
  const trimmed = String(pin).trim();
  if (trimmed.length >= 6) return trimmed;
  return trimmed.padEnd(6, '0');
}

const HEAD_ADMINS = [
  { name: '조하나', loginId: '조하나', emailLocal: 'johana', pin: '0000' },
  { name: '김선아', loginId: '김선아', emailLocal: 'seona', pin: '0000' },
  { name: '박민영', loginId: '박민영', emailLocal: 'minyeong', pin: '0000' },
  { name: '오현수', loginId: '오현수', emailLocal: 'hyunsu', pin: '0000' },
  { name: '이지수', loginId: '이지수', emailLocal: 'jisu', pin: '0000' },
  { name: '황보예린', loginId: '황보예린', emailLocal: 'yerin', pin: '0000' },
];

const BOOTH_STAFF = [
  {
    name: '박미진',
    loginId: '박미진',
    emailLocal: 'mijin',
    pin: '0808',
    experienceGroup: 'BOARD_GAME',
    assignedBoothIds: ['booth-01'],
  },
  {
    name: '홍성준',
    loginId: '홍성준',
    emailLocal: 'seongjun',
    pin: '0808',
    experienceGroup: 'BOARD_GAME',
    assignedBoothIds: ['booth-02'],
  },
  {
    name: '오경서',
    loginId: '오경서',
    emailLocal: 'gyeongseo',
    pin: '0808',
    experienceGroup: 'BOARD_GAME',
    assignedBoothIds: ['booth-03'],
  },
  {
    name: '김선우',
    loginId: '김선우',
    emailLocal: 'seonwoo',
    pin: '0808',
    experienceGroup: 'BOARD_GAME',
    assignedBoothIds: ['booth-04'],
  },
  {
    name: '이현주',
    loginId: '이현주',
    emailLocal: 'hyeonju',
    pin: '0808',
    experienceGroup: 'BOARD_GAME',
    assignedBoothIds: ['booth-05'],
  },
  {
    name: '박주홍',
    loginId: '박주홍',
    emailLocal: 'juhong',
    pin: '0808',
    experienceGroup: 'BOARD_GAME',
    assignedBoothIds: ['booth-06'],
  },
  {
    name: '부스7',
    loginId: '부스7',
    emailLocal: 'booth7',
    pin: '0808',
    experienceGroup: 'BOARD_GAME',
    assignedBoothIds: ['booth-07'],
  },
  {
    name: '김서헌',
    loginId: '김서헌',
    emailLocal: 'seohon',
    pin: '0808',
    experienceGroup: 'CREATIVE_CONVERGENCE',
    assignedBoothIds: ['booth-08'],
  },
  {
    name: '이서헌',
    loginId: '이서헌',
    emailLocal: 'iseohon',
    pin: '0808',
    experienceGroup: 'CREATIVE_CONVERGENCE',
    assignedBoothIds: ['booth-09'],
  },
  {
    name: '김영찬',
    loginId: '김영찬',
    emailLocal: 'youngchan',
    pin: '0808',
    experienceGroup: 'CREATIVE_CONVERGENCE',
    assignedBoothIds: ['booth-10'],
  },
  {
    name: '부스11',
    loginId: '부스11',
    emailLocal: 'booth11',
    pin: '0808',
    experienceGroup: 'CREATIVE_CONVERGENCE',
    assignedBoothIds: ['booth-11'],
  },
  {
    name: '정규경',
    loginId: '정규경',
    emailLocal: 'gyugyeong',
    pin: '0808',
    experienceGroup: 'CREATIVE_CONVERGENCE',
    assignedBoothIds: ['booth-12'],
  },
  {
    name: '이동한',
    loginId: '이동한',
    emailLocal: 'donghan',
    pin: '0808',
    experienceGroup: 'CREATIVE_CONVERGENCE',
    assignedBoothIds: ['booth-13'],
  },
  {
    name: '미래잇다',
    loginId: '미래잇다',
    emailLocal: 'miraeitda',
    pin: '0808',
    experienceGroup: 'CREATIVE_CONVERGENCE',
    assignedBoothIds: ['booth-14'],
  },
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
  const tokens = json?.tokens;
  if (!tokens?.access_token) {
    throw new Error('Firebase CLI 로그인 토큰이 없습니다.');
  }
  return { configPath, json, tokens };
}

async function getAccessToken() {
  const { configPath, json, tokens } = loadAccessToken();
  const expiresAt = Number(tokens.expires_at || 0);
  if (tokens.access_token && Date.now() < expiresAt - 60_000) {
    return tokens.access_token;
  }
  if (!tokens.refresh_token) {
    throw new Error('Firebase CLI refresh token이 없습니다. firebase login 후 다시 시도하세요.');
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
  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      `Firebase 토큰 갱신 실패: ${data?.error_description || data?.error || res.status}`,
    );
  }

  tokens.access_token = data.access_token;
  tokens.expires_in = data.expires_in;
  tokens.expires_at = Date.now() + Number(data.expires_in) * 1000;
  if (data.id_token) tokens.id_token = data.id_token;
  json.tokens = tokens;
  fs.writeFileSync(configPath, JSON.stringify(json, null, 2));
  return tokens.access_token;
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
    accessCodeConfigured: Boolean(booth.accessCode),
    accessCode: booth.accessCode ?? null,
    capacity: booth.capacity,
    waitlistCapacity: booth.waitlistCapacity,
    status: booth.status,
    staffingType: booth.staffingType,
    activities: booth.activities ?? [],
    operationMode: booth.operationMode ?? 'TIME_RESERVATION',
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

async function seedOperator(accessToken, person, assignment) {
  const email = `${person.emailLocal}@boardgame-a06d1.firebaseapp.com`;
  const authPassword = pinToAuthPassword(person.pin);
  const auth = await identitySignUp(email, authPassword, person.name);
  const uid = auth.localId;
  console.log(`  auth ${person.loginId} → ${uid}`);

  await upsertDocument(accessToken, 'staffAssignments', uid, {
    uid,
    name: person.name,
    loginId: person.loginId,
    email,
    role: assignment.role,
    experienceGroup: assignment.experienceGroup,
    assignedBoothIds: assignment.assignedBoothIds,
    isActive: true,
    pinHint: person.pin,
  });

  await upsertDocument(accessToken, 'staffLoginIndex', person.loginId, {
    loginId: person.loginId,
    name: person.name,
    email,
    uid,
  });
}

async function main() {
  console.log('Loading Firebase access token...');
  const accessToken = await getAccessToken();

  const booths = JSON.parse(
    fs.readFileSync(path.join(root, 'scripts/booths-seed.json'), 'utf8'),
  );
  const allBoothIds = booths.map((b) => b.id);

  console.log(`Seeding ${booths.length} booths...`);
  for (const booth of booths) {
    await upsertDocument(accessToken, 'booths', booth.id, sanitizeBooth(booth));
    console.log(`  booth ${booth.id}`);
  }

  console.log(`Seeding ${HEAD_ADMINS.length} head admins (PIN 0000)...`);
  for (const person of HEAD_ADMINS) {
    await seedOperator(accessToken, person, {
      role: 'HEAD_ADMIN',
      experienceGroup: null,
      assignedBoothIds: allBoothIds,
    });
  }

  console.log(`Seeding ${BOOTH_STAFF.length} booth staff (PIN 0808)...`);
  for (const person of BOOTH_STAFF) {
    await seedOperator(accessToken, person, {
      role: 'BOOTH_STAFF',
      experienceGroup: person.experienceGroup,
      assignedBoothIds: person.assignedBoothIds,
    });
  }

  console.log('\nDone. Head admin: name + 0000 / Booth staff: name + 0808');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
