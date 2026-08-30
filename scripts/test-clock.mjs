/**
 * 점검용 가상 시계 스위치.
 *
 * 사용:
 *   node scripts/test-clock.mjs 08:29      # 서버가 08:29 기준으로 동작 (기본 2시간 후 자동 만료)
 *   node scripts/test-clock.mjs 12:46 30   # 12:46 기준, 30분 후 자동 만료
 *   node scripts/test-clock.mjs off        # 즉시 해제
 *   node scripts/test-clock.mjs status     # 현재 상태 확인
 *
 * 서버(Cloud Functions)는 expiresAt 이 지나면 설정을 무시하고 실제 시각으로 돌아간다.
 * 끄는 걸 잊어도 행사 당일 사고로 이어지지 않게 하기 위한 안전장치다.
 */
import fs from 'node:fs';
import path from 'node:path';

const projectId = 'boardgame-a06d1';

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

const docUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/config/testClock`;

async function writeConfig(accessToken, fields) {
  const mask = Object.keys(fields)
    .map((key) => `updateMask.fieldPaths=${key}`)
    .join('&');
  const res = await fetch(`${docUrl}?${mask}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new Error(`설정 저장 실패: ${await res.text()}`);
}

async function readConfig(accessToken) {
  const res = await fetch(docUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`설정 조회 실패: ${await res.text()}`);
  const json = await res.json();
  const f = json.fields ?? {};
  return {
    enabled: f.enabled?.booleanValue ?? false,
    simulatedTime: f.simulatedTime?.stringValue ?? null,
    expiresAt: f.expiresAt?.stringValue ?? null,
  };
}

const arg = (process.argv[2] ?? '').trim();
const ttlMinutes = Number(process.argv[3] ?? 120);
const accessToken = await getAccessToken();

if (!arg || arg === 'status') {
  const config = await readConfig(accessToken);
  if (!config || !config.enabled) {
    console.log('점검 모드: 꺼짐 (서버가 실제 시각으로 동작)');
  } else {
    const expired = Date.now() >= Date.parse(config.expiresAt ?? '');
    console.log(`점검 모드: ${expired ? '만료됨 (실제 시각으로 동작)' : '켜짐'}`);
    console.log(`  가상 시각: ${config.simulatedTime}`);
    console.log(`  만료: ${config.expiresAt}`);
  }
} else if (arg === 'off') {
  await writeConfig(accessToken, { enabled: { booleanValue: false } });
  console.log('점검 모드를 껐습니다. 서버가 실제 시각으로 동작합니다.');
} else {
  if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(arg)) {
    console.error(`시각 형식이 잘못됐습니다: "${arg}" (예: 08:29)`);
    process.exit(1);
  }
  if (!Number.isFinite(ttlMinutes) || ttlMinutes <= 0 || ttlMinutes > 720) {
    console.error('만료 시간(분)은 1~720 사이여야 합니다.');
    process.exit(1);
  }
  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000).toISOString();
  await writeConfig(accessToken, {
    enabled: { booleanValue: true },
    simulatedTime: { stringValue: arg },
    expiresAt: { stringValue: expiresAt },
  });
  console.log(`점검 모드 켜짐 — 서버가 ${arg} 기준으로 동작합니다.`);
  console.log(`${ttlMinutes}분 후(${expiresAt}) 자동 해제됩니다.`);
}
