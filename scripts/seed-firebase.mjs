/**
 * Firebase 시드: 운영자 Auth 계정 + staffAssignments + booths + staffLoginIndex
 *
 * 사용: node scripts/seed-firebase.mjs
 *
 * 운영자 PIN 은 새 계정에 한해 무작위 6자리로 만들어 화면에 출력한다.
 * 이미 있는 계정은 비밀번호를 건드리지 않는다 → 교체는 scripts/rotate-staff-pins.mjs.
 * 부스 현장코드는 booths-seed.json 의 accessCode 가 있을 때만 boothSecrets 에 쓴다.
 * (공개 저장소이므로 JSON 에는 코드를 두지 않는다. 운영 앱 또는 migrate-access-codes.mjs 로 관리.)
 */
import crypto from 'node:crypto';
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

function randomPin() {
  return String(crypto.randomInt(100000, 1_000_000));
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
    emailLocal: 'mijin',    experienceGroup: 'BOARD_GAME',
    assignedBoothIds: ['booth-01'],
  },
  {
    name: '홍성준',
    loginId: '홍성준',
    emailLocal: 'seongjun',    experienceGroup: 'BOARD_GAME',
    assignedBoothIds: ['booth-02'],
  },
  {
    name: '오경서',
    loginId: '오경서',
    emailLocal: 'gyeongseo',    experienceGroup: 'BOARD_GAME',
    assignedBoothIds: ['booth-03'],
  },
  {
    name: '김선우',
    loginId: '김선우',
    emailLocal: 'seonwoo',    experienceGroup: 'BOARD_GAME',
    assignedBoothIds: ['booth-04'],
  },
  {
    // 본부 관리자 이지수와 이름이 겹쳐 loginId는 부스5
    name: '이지수',
    loginId: '부스5',
    emailLocal: 'booth5',    experienceGroup: 'BOARD_GAME',
    assignedBoothIds: ['booth-05'],
  },
  {
    name: '이현주',
    loginId: '이현주',
    emailLocal: 'hyeonju',    experienceGroup: 'BOARD_GAME',
    assignedBoothIds: ['booth-06'],
  },
  {
    name: '박주홍',
    loginId: '박주홍',
    emailLocal: 'juhong',    experienceGroup: 'BOARD_GAME',
    assignedBoothIds: ['booth-07'],
  },
  {
    name: '이서현',
    loginId: '이서현',
    emailLocal: 'iseohon',    experienceGroup: 'CREATIVE_CONVERGENCE',
    assignedBoothIds: ['booth-08'],
  },
  {
    name: '김서현',
    loginId: '김서현',
    emailLocal: 'seohon',    experienceGroup: 'CREATIVE_CONVERGENCE',
    assignedBoothIds: ['booth-09'],
  },
  {
    name: '정규경',
    loginId: '정규경',
    emailLocal: 'gyugyeong',    experienceGroup: 'CREATIVE_CONVERGENCE',
    assignedBoothIds: ['booth-10'],
  },
  {
    name: '이동한',
    loginId: '이동한',
    emailLocal: 'donghan',    experienceGroup: 'CREATIVE_CONVERGENCE',
    assignedBoothIds: ['booth-11'],
  },
  {
    name: '김영찬',
    loginId: '김영찬',
    emailLocal: 'youngchan',    experienceGroup: 'CREATIVE_CONVERGENCE',
    assignedBoothIds: ['booth-12'],
  },
  {
    // 본부 관리자 오현수와 이름이 겹쳐 loginId는 부스13
    name: '오현수',
    loginId: '부스13',
    emailLocal: 'booth13',    experienceGroup: 'CREATIVE_CONVERGENCE',
    assignedBoothIds: ['booth-13'],
  },
  {
    name: '미래잇다',
    loginId: '미래잇다',
    emailLocal: 'miraeitda',    experienceGroup: 'CREATIVE_CONVERGENCE',
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
      return { exists: true };
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

function sanitizeBooth(booth, existing = null) {
  const existingSlots = Array.isArray(existing?.slots) ? existing.slots : [];
  const existingById = new Map(
    existingSlots.map((slot) => [slot.id, slot]),
  );
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
    // 코드 값은 공개 문서에 두지 않는다. JSON 에 코드가 없으면 기존 설정 여부를 유지한다.
    accessCodeConfigured: booth.accessCode
      ? true
      : Boolean(existing?.accessCodeConfigured),
    capacity: booth.capacity,
    waitlistCapacity: booth.waitlistCapacity,
    status: booth.status,
    staffingType: booth.staffingType,
    activities: booth.activities ?? [],
    reserveGames: booth.reserveGames ?? [],
    operationMode: booth.operationMode ?? 'TIME_RESERVATION',
    walkInPublicStatus: booth.walkInPublicStatus ?? 'OPEN',
    walkInDuplicateBlockCount: Number(booth.walkInDuplicateBlockCount ?? 0),
    slots: booth.slots.map((slot) => {
      const prev = existingById.get(slot.id);
      return {
        id: slot.id,
        scheduleSlotId: slot.scheduleSlotId,
        startTime: slot.startTime,
        endTime: slot.endTime,
        period: slot.period,
        confirmedCount: Number(prev?.confirmedCount ?? 0),
        waitlistCount: Number(prev?.waitlistCount ?? 0),
        bookingOpen:
          prev?.bookingOpen === undefined ? true : Boolean(prev.bookingOpen),
      };
    }),
  };
}

async function seedOperator(accessToken, person, assignment) {
  const email = `${person.emailLocal}@boardgame-a06d1.firebaseapp.com`;
  const pin = randomPin();
  const auth = await identitySignUp(email, pinToAuthPassword(pin), person.name);
  let uid = auth.localId;
  if (auth.exists) {
    // 기존 계정 — 비밀번호는 그대로 두고 uid 만 staffLoginIndex 에서 가져온다
    const existingIndex = await fetchDocument(accessToken, 'staffLoginIndex', person.loginId);
    uid = existingIndex?.uid;
    if (!uid) {
      throw new Error(`${person.loginId}: 계정은 있는데 staffLoginIndex 에 uid 가 없습니다. rotate-staff-pins.mjs 를 참고하세요.`);
    }
    console.log(`  auth ${person.loginId} → ${uid} (기존 계정, PIN 유지)`);
  } else {
    console.log(`  auth ${person.loginId} → ${uid}  새 PIN: ${pin}`);
  }

  await upsertDocument(accessToken, 'staffAssignments', uid, {
    uid,
    name: person.name,
    loginId: person.loginId,
    email,
    role: assignment.role,
    experienceGroup: assignment.experienceGroup,
    assignedBoothIds: assignment.assignedBoothIds,
    isActive: true,
  });

  await upsertDocument(accessToken, 'staffLoginIndex', person.loginId, {
    loginId: person.loginId,
    name: person.name,
    email,
    uid,
  });
}

function fromFirestoreValue(value) {
  if (!value || typeof value !== 'object') return null;
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('booleanValue' in value) return Boolean(value.booleanValue);
  if ('nullValue' in value) return null;
  if ('mapValue' in value) {
    const out = {};
    for (const [k, v] of Object.entries(value.mapValue.fields || {})) {
      out[k] = fromFirestoreValue(v);
    }
    return out;
  }
  if ('arrayValue' in value) {
    return (value.arrayValue.values || []).map((item) => fromFirestoreValue(item));
  }
  return null;
}

async function fetchDocument(accessToken, collection, docId) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}/${encodeURIComponent(docId)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) return null;
  const body = await res.json();
  return fromFirestoreValue({ mapValue: { fields: body.fields ?? {} } });
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
    const existing = await fetchDocument(accessToken, 'booths', booth.id);
    await upsertDocument(
      accessToken,
      'booths',
      booth.id,
      sanitizeBooth(booth, existing),
    );
    if (booth.accessCode) {
      await upsertDocument(accessToken, 'boothSecrets', booth.id, {
        accessCode: String(booth.accessCode),
        updatedAt: new Date().toISOString(),
        updatedBy: 'seed',
      });
    }
    console.log(`  booth ${booth.id}`);
  }

  console.log(`Seeding ${HEAD_ADMINS.length} head admins...`);
  for (const person of HEAD_ADMINS) {
    await seedOperator(accessToken, person, {
      role: 'HEAD_ADMIN',
      experienceGroup: null,
      assignedBoothIds: allBoothIds,
    });
  }

  console.log(`Seeding ${BOOTH_STAFF.length} booth staff...`);
  for (const person of BOOTH_STAFF) {
    await seedOperator(accessToken, person, {
      role: 'BOOTH_STAFF',
      experienceGroup: person.experienceGroup,
      assignedBoothIds: person.assignedBoothIds,
    });
  }

  console.log('\nDone. 새로 만든 계정의 PIN 은 위 출력에만 있으니 지금 옮겨 적으세요.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
