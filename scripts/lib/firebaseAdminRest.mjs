/**
 * 운영 스크립트 공용 — Firebase CLI 로그인 토큰으로 Firestore / Identity Toolkit REST 호출.
 *
 * firebase login 이 되어 있어야 한다 (~/.config/configstore/firebase-tools.json).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const projectId = 'boardgame-a06d1';
export const firestoreBase = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

function loadTokens() {
  const configPath = path.join(
    process.env.USERPROFILE || process.env.HOME || '',
    '.config',
    'configstore',
    'firebase-tools.json',
  );
  const json = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  if (!json?.tokens?.access_token) {
    throw new Error('Firebase CLI 토큰이 없습니다. npx firebase-tools login 후 다시 시도하세요.');
  }
  return json.tokens;
}

export async function getAccessToken() {
  const tokens = loadTokens();
  if (tokens.access_token && Date.now() < Number(tokens.expires_at || 0) - 60_000) {
    return tokens.access_token;
  }
  // Firebase CLI 공개 OAuth 클라이언트 (firebase-tools 소스에 포함된 값, 비밀 아님)
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

/** 무작위 6자리 숫자 (100000~999999) — Math.random 대신 CSPRNG */
export function randomSixDigits() {
  return String(crypto.randomInt(100000, 1_000_000));
}

// ---- Firestore 값 변환 ----

export function toFirestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(toFirestoreValue) } };
  }
  if (typeof value === 'object') {
    return { mapValue: { fields: toFirestoreFields(value) } };
  }
  throw new Error(`지원하지 않는 값: ${typeof value}`);
}

export function toFirestoreFields(obj) {
  const fields = {};
  for (const [key, value] of Object.entries(obj)) {
    fields[key] = toFirestoreValue(value);
  }
  return fields;
}

export function fromFirestoreValue(value) {
  if (!value || typeof value !== 'object') return null;
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('booleanValue' in value) return Boolean(value.booleanValue);
  if ('nullValue' in value) return null;
  if ('timestampValue' in value) return value.timestampValue;
  if ('mapValue' in value) return fromFirestoreFields(value.mapValue.fields || {});
  if ('arrayValue' in value) {
    return (value.arrayValue.values || []).map(fromFirestoreValue);
  }
  return null;
}

export function fromFirestoreFields(fields) {
  const out = {};
  for (const [key, value] of Object.entries(fields || {})) {
    out[key] = fromFirestoreValue(value);
  }
  return out;
}

// ---- Firestore REST ----

function authHeaders(token) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

/** 컬렉션 전체 나열 → [{ id, data }] */
export async function listDocuments(token, collection) {
  const docs = [];
  let pageToken = '';
  do {
    const url = `${firestoreBase}/${collection}?pageSize=300${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
    const res = await fetch(url, { headers: authHeaders(token) });
    if (!res.ok) throw new Error(`list ${collection}: ${await res.text()}`);
    const json = await res.json();
    for (const doc of json.documents ?? []) {
      docs.push({ id: doc.name.split('/').pop(), data: fromFirestoreFields(doc.fields) });
    }
    pageToken = json.nextPageToken ?? '';
  } while (pageToken);
  return docs;
}

export async function getDocument(token, docPath) {
  const res = await fetch(`${firestoreBase}/${docPath}`, { headers: authHeaders(token) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`get ${docPath}: ${await res.text()}`);
  const json = await res.json();
  return fromFirestoreFields(json.fields);
}

/**
 * 문서 부분 갱신 (없으면 생성). `deleteFields` 에 적은 필드는 제거된다.
 * updateMask 에 포함되고 본문에 없는 필드는 Firestore 가 삭제 처리한다.
 */
export async function patchDocument(token, docPath, data, deleteFields = []) {
  const mask = [...Object.keys(data), ...deleteFields]
    .map((key) => `updateMask.fieldPaths=${encodeURIComponent(key)}`)
    .join('&');
  const res = await fetch(`${firestoreBase}/${docPath}?${mask}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({ fields: toFirestoreFields(data) }),
  });
  if (!res.ok) throw new Error(`patch ${docPath}: ${await res.text()}`);
}

// ---- Identity Toolkit (Firebase Auth 관리자 호출) ----

/** 운영자 계정 비밀번호 교체 (프로젝트 소유자 토큰 필요) */
export async function setAuthPassword(token, uid, password) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:update`,
    {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ localId: uid, password }),
    },
  );
  if (!res.ok) throw new Error(`accounts:update ${uid}: ${await res.text()}`);
  return res.json();
}
