/**
 * 동시 예약 시뮬레이션 — 실제 Firestore 를 건드리지 않고, 빌드된 함수 코드(functions/lib)를
 * 메모리 안의 가짜 Firestore 위에서 그대로 돌린다.
 *
 * 사용:
 *   npm run functions:build && node scripts/concurrency-sim.cjs
 *   node scripts/concurrency-sim.cjs 5        # 시나리오 묶음을 5번 반복 (기본 3)
 *
 * 가짜 Firestore 가 흉내 내는 것:
 *   - 모든 읽기/쓰기에 무작위 지연(가상 20~60ms) → 요청들이 실제처럼 서로 끼어든다
 *   - 트랜잭션은 직렬화 검증: 읽은 문서·쿼리 결과가 커밋 시점에 바뀌었으면 ABORT → 재시도
 *   - 재시도 간격은 Admin SDK 와 같은 지수 백오프(1s × 1.5ⁿ, 지터 0~2배), maxAttempts 초과 시 ABORTED
 *     (직렬화 검증은 실제 Firestore 의 잠금 대기보다 ABORT 가 많이 나는 쪽 — 즉 실제보다 불리한 조건이다)
 *   - 함수 제한시간(가상 30초)을 넘긴 요청은 DEADLINE 실패로 집계
 *   시간은 TIME_SCALE 배로 압축해서 돌린다 (가상 1초 = 실제 1000/TIME_SCALE ms).
 *
 * 검사하는 불변식:
 *   1. 어떤 회차도 정원을 넘지 않는다
 *   2. 같은 참가자(연락처+이름)가 진행 중 예약을 2건 이상 갖지 않는다 (따닥 더블탭 포함)
 *   3. 부스 문서의 slots[].confirmedCount 캐시가 실제 예약 수와 일치한다
 *   4. 참가자에게 'internal' / 시간초과 오류가 나가지 않는다
 */
const Module = require('node:module');
const path = require('node:path');

const TIME_SCALE = Number(process.env.SIM_TIME_SCALE ?? 4); // 너무 크면 OS 타이머 해상도(1~15ms) 때문에 지연이 부풀려진다
const FUNCTION_TIMEOUT_MS = 30_000;
const repeat = Number(process.argv[2] ?? 3);

const sleep = (virtualMs) =>
  new Promise((resolve) => setTimeout(resolve, virtualMs / TIME_SCALE));
const rand = (min, max) => min + Math.random() * (max - min);
const opLatency = () => sleep(rand(20, 60));

// ---------------------------------------------------------------- fake firestore
const SENTINEL = Symbol('fieldValue');
const FieldValue = {
  serverTimestamp: () => ({ [SENTINEL]: 'ts' }),
  increment: (n) => ({ [SENTINEL]: 'inc', n }),
  delete: () => ({ [SENTINEL]: 'del' }),
};

function applyPatch(base, patch) {
  const next = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value && value[SENTINEL] === 'ts') next[key] = new Date().toISOString();
    else if (value && value[SENTINEL] === 'inc') next[key] = Number(next[key] ?? 0) + value.n;
    else if (value && value[SENTINEL] === 'del') delete next[key];
    else next[key] = value;
  }
  return next;
}

class FakeDb {
  constructor() {
    this.docs = new Map(); // path -> { data, version }
    this.clock = 0;
    this.stats = { aborts: 0, commits: 0 };
  }
  collection(name) {
    return new CollectionRef(this, name);
  }
  _write(pathKey, data) {
    this.clock += 1;
    if (data === null) this.docs.delete(pathKey);
    else this.docs.set(pathKey, { data: structuredClone(data), version: this.clock });
  }
  _snap(ref) {
    const entry = this.docs.get(ref.path);
    return {
      exists: Boolean(entry),
      id: ref.id,
      ref,
      data: () => (entry ? structuredClone(entry.data) : undefined),
      _version: entry ? entry.version : 0,
    };
  }
  _runQuery(query) {
    const prefix = `${query.collectionName}/`;
    const docs = [];
    for (const [key, entry] of this.docs) {
      if (!key.startsWith(prefix)) continue;
      if (query.filters.every(([field, value]) => entry.data[field] === value)) {
        const ref = new DocRef(this, query.collectionName, key.slice(prefix.length));
        docs.push(this._snap(ref));
      }
    }
    return docs;
  }
  async runTransaction(fn, opts = {}) {
    const maxAttempts = opts.maxAttempts ?? 5;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      if (attempt > 0) {
        // nodejs-firestore ExponentialBackoff: 1s × 1.5ⁿ, 지터 ±100%
        await sleep(1000 * 1.5 ** (attempt - 1) * rand(0, 2));
      }
      const tx = new FakeTx(this);
      const result = await fn(tx); // 사용자 코드가 던진 오류는 재시도 없이 그대로 전파
      await opLatency();
      if (tx._validate()) {
        tx._apply();
        this.stats.commits += 1;
        return result;
      }
      this.stats.aborts += 1;
    }
    const error = new Error('10 ABORTED: Too much contention on these documents. Please try again.');
    error.code = 10;
    throw error;
  }
}

class DocRef {
  constructor(db, collectionName, id) {
    this.db = db;
    this.collectionName = collectionName;
    this.id = id;
    this.path = `${collectionName}/${id}`;
  }
  async get() {
    await opLatency();
    return this.db._snap(this);
  }
  async set(data, options) {
    await opLatency();
    const base = options?.merge ? this.db.docs.get(this.path)?.data ?? {} : {};
    this.db._write(this.path, applyPatch(base, data));
  }
  async update(patch) {
    await opLatency();
    const entry = this.db.docs.get(this.path);
    if (!entry) throw new Error(`5 NOT_FOUND: ${this.path}`);
    this.db._write(this.path, applyPatch(entry.data, patch));
  }
  async delete() {
    await opLatency();
    this.db._write(this.path, null);
  }
}

class Query {
  constructor(db, collectionName, filters) {
    this.db = db;
    this.collectionName = collectionName;
    this.filters = filters;
  }
  where(field, op, value) {
    if (op !== '==') throw new Error(`fake firestore: unsupported op ${op}`);
    return new Query(this.db, this.collectionName, [...this.filters, [field, value]]);
  }
  async get() {
    await opLatency();
    return { docs: this.db._runQuery(this) };
  }
}

let autoId = 0;
class CollectionRef extends Query {
  constructor(db, name) {
    super(db, name, []);
  }
  doc(id) {
    return new DocRef(this.db, this.collectionName, id ?? `auto-${(autoId += 1)}`);
  }
  async add(data) {
    const ref = this.doc();
    await ref.set(data);
    return ref;
  }
}

const signature = (docs) =>
  docs
    .map((doc) => `${doc.id}@${doc._version}`)
    .sort()
    .join(',');

class FakeTx {
  constructor(db) {
    this.db = db;
    this.readDocs = new Map(); // path -> version
    this.readQueries = []; // [query, signature]
    this.writes = [];
  }
  async get(target) {
    await opLatency();
    if (target instanceof DocRef) {
      const snap = this.db._snap(target);
      this.readDocs.set(target.path, snap._version);
      return snap;
    }
    const docs = this.db._runQuery(target);
    this.readQueries.push([target, signature(docs)]);
    return { docs };
  }
  set(ref, data, options) {
    this.writes.push({ kind: options?.merge ? 'merge' : 'set', ref, data });
  }
  update(ref, data) {
    this.writes.push({ kind: 'update', ref, data });
  }
  delete(ref) {
    this.writes.push({ kind: 'delete', ref });
  }
  _validate() {
    for (const [pathKey, version] of this.readDocs) {
      if ((this.db.docs.get(pathKey)?.version ?? 0) !== version) return false;
    }
    for (const [query, sig] of this.readQueries) {
      if (signature(this.db._runQuery(query)) !== sig) return false;
    }
    return true;
  }
  _apply() {
    for (const write of this.writes) {
      const current = this.db.docs.get(write.ref.path)?.data;
      if (write.kind === 'delete') this.db._write(write.ref.path, null);
      else if (write.kind === 'set') this.db._write(write.ref.path, applyPatch({}, write.data));
      else this.db._write(write.ref.path, applyPatch(current ?? {}, write.data));
    }
  }
}

// ---------------------------------------------------------------- module stubs
class HttpsError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}
let db = new FakeDb();
const dbProxy = new Proxy(
  {},
  { get: (_target, prop) => (typeof db[prop] === 'function' ? db[prop].bind(db) : db[prop]) },
);
const stubs = {
  'firebase-admin/app': { initializeApp: () => ({}) },
  'firebase-admin/firestore': { getFirestore: () => dbProxy, FieldValue },
  'firebase-functions/v2/https': { onCall: (_opts, handler) => handler, HttpsError },
  'firebase-functions/v2/options': { setGlobalOptions: () => undefined },
};
const originalLoad = Module._load;
Module._load = function patchedLoad(request, ...rest) {
  if (stubs[request]) return stubs[request];
  return originalLoad.call(this, request, ...rest);
};
const originalConsoleError = console.error;
console.error = () => undefined; // 함수 내부의 오류 로그는 집계로 대신한다
const FUNCTIONS_LIB = path.join(__dirname, '..', 'functions', 'lib');
let fns = require(path.join(FUNCTIONS_LIB, 'index.js'));
/** 함수 모듈을 새로 불러와 인스턴스 내부 캐시(점검 시계·회차 현황)를 비운다 — 새 인스턴스가 뜬 것과 같다 */
function reloadFunctions() {
  for (const key of Object.keys(require.cache)) {
    if (key.startsWith(FUNCTIONS_LIB)) delete require.cache[key];
  }
  fns = require(path.join(FUNCTIONS_LIB, 'index.js'));
}

// ---------------------------------------------------------------- fixtures
const SLOT_IDS = ['s1', 's2', 's3', 's4'];
function seed({ booths = 5, capacity = 6 } = {}) {
  db = new FakeDb();
  db._write('config/testClock', {
    enabled: true,
    mode: 'OPEN',
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  });
  db._write('staffAssignments/staff-1', {
    isActive: true,
    role: 'HEAD_ADMIN',
    name: '시뮬 운영자',
    assignedBoothIds: [],
  });
  // 예약 취소는 이 사람만 할 수 있다
  db._write('staffAssignments/staff-yerin', {
    isActive: true,
    role: 'HEAD_ADMIN',
    name: '황보예린',
    assignedBoothIds: [],
  });
  db._write('staffAssignments/staff-booth', {
    isActive: true,
    role: 'BOOTH_STAFF',
    name: '시뮬 부스팀장',
    assignedBoothIds: ['b1'],
  });
  for (let i = 1; i <= booths; i += 1) {
    const walkIn = i === booths; // 마지막 부스는 현장등록 부스
    db._write(`booths/b${i}`, {
      number: 100 + i, // asBooth 가 3·6·7·8·9번을 현장등록으로 강제하므로 겹치지 않게
      name: `시뮬 부스 ${i}`,
      capacity,
      status: 'BOOKING_OPEN',
      accessCodeConfigured: false,
      operationMode: walkIn ? 'WALK_IN_CHECKIN' : 'TIME_RESERVATION',
      slots: SLOT_IDS.map((id, index) => ({
        id,
        scheduleSlotId: `sch-${id}`,
        startTime: `1${index}:00`,
        endTime: `1${index}:25`,
        period: 'MORNING',
        confirmedCount: 0,
        bookingOpen: true,
      })),
    });
  }
}

let phoneSeq = 0;
const newPhone = () => `010${String(10_000_000 + (phoneSeq += 1)).padStart(8, '0')}`;

async function invoke(name, data, auth) {
  const started = performance.now();
  try {
    const result = await fns[name]({
      data,
      auth,
      rawRequest: { ip: '10.0.0.1', headers: {} },
    });
    const ms = (performance.now() - started) * TIME_SCALE;
    if (ms > FUNCTION_TIMEOUT_MS) return { ok: false, code: 'DEADLINE', message: '30초 제한 초과', ms };
    return { ok: true, result, ms };
  } catch (error) {
    const ms = (performance.now() - started) * TIME_SCALE;
    if (ms > FUNCTION_TIMEOUT_MS) return { ok: false, code: 'DEADLINE', message: '30초 제한 초과', ms };
    return { ok: false, code: error.code ?? 'throw', message: error.message, ms };
  }
}

const book = (boothId, slotId, phone, name = '참가자') =>
  invoke('createReservation', {
    boothId,
    slotId,
    participantName: name,
    phone,
    gradeOrAge: '초3',
    gender: 'MALE',
  });

// ---------------------------------------------------------------- invariants
// 미도착(NO_SHOW)도 자리를 계속 차지한다 — 자리를 비우는 것은 취소뿐
const OCCUPYING = ['CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'NO_SHOW'];
const BLOCKING = ['CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'];

function audit({ staffAddedAllowed = false } = {}) {
  const problems = [];
  const reservations = [...db.docs]
    .filter(([key]) => key.startsWith('reservations/'))
    .map(([, entry]) => entry.data);
  const booths = [...db.docs].filter(([key]) => key.startsWith('booths/'));

  for (const [key, entry] of booths) {
    const boothId = key.slice('booths/'.length);
    for (const slot of entry.data.slots) {
      const actual = reservations.filter(
        (r) => r.boothId === boothId && r.slotId === slot.id && OCCUPYING.includes(r.status),
      ).length;
      if (!staffAddedAllowed && actual > entry.data.capacity) {
        problems.push(`정원 초과: ${boothId}/${slot.id} ${actual}/${entry.data.capacity}`);
      }
      if (slot.confirmedCount !== actual) {
        problems.push(`카운터 불일치: ${boothId}/${slot.id} 캐시 ${slot.confirmedCount} ≠ 실제 ${actual}`);
      }
    }
  }
  const byPhone = new Map();
  for (const r of reservations) {
    if (!r.phone || !BLOCKING.includes(r.status)) continue;
    // 참가자 구분 = 연락처 + 이름(공백·대소문자 무시) — 형제는 같은 번호로 각각 예약할 수 있다
    const who = `${r.phone} ${String(r.participantName).replace(/\s+/g, '').toLowerCase()}`;
    byPhone.set(who, (byPhone.get(who) ?? 0) + 1);
  }
  for (const [phone, count] of byPhone) {
    if (count > 1) problems.push(`중복 예약: ${phone} 진행 중 ${count}건`);
  }
  const walkIns = [...db.docs]
    .filter(([key]) => key.startsWith('walkInRegistrations/'))
    .map(([, entry]) => entry.data);
  const walkInKeys = new Map();
  for (const w of walkIns) {
    if (w.status !== 'REGISTERED') continue;
    const k = `${w.boothId}|${w.phone}|${w.participantName}`;
    walkInKeys.set(k, (walkInKeys.get(k) ?? 0) + 1);
  }
  for (const [k, count] of walkInKeys) {
    if (count > 1) problems.push(`현장등록 중복: ${k} ${count}건`);
  }
  return { problems, reservations: reservations.length };
}

function summarize(results) {
  const ok = results.filter((r) => r.ok).length;
  const codes = {};
  for (const r of results) if (!r.ok) codes[r.code] = (codes[r.code] ?? 0) + 1;
  const sorted = results.map((r) => r.ms).sort((a, b) => a - b);
  const p = (q) => sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)] ?? 0;
  return { ok, codes, p50: p(0.5), p95: p(0.95), max: sorted.at(-1) ?? 0 };
}

// 참가자에게 보여도 되는 정상 거절(정원 마감·중복) 외의 오류 = 시스템 오류
const SYSTEM_CODES = ['internal', 'DEADLINE', 'throw', 'deadline-exceeded', 'unavailable', 'aborted', 10];

// ---------------------------------------------------------------- scenarios
const scenarios = {
  async '오픈 정각 — 08:29:58 에 🔒 을 본 화면이 08:30:00 에 바로 열린다 (서버 캐시가 정각을 넘지 않음)'() {
    seed();
    reloadFunctions();
    db._write('config/testClock', { enabled: false }); // 실제 시각 규칙으로 판정
    const realNow = Date.now;
    const extra = [];
    const at = (iso) => {
      const fixed = Date.parse(iso);
      Date.now = () => fixed;
    };
    try {
      at('2026-09-18T23:29:58.000Z'); // KST 9/19 08:29:58
      const before = await invoke('getBoothSessions', { boothId: 'b1' });
      if (!before.result.sessions.every((item) => item.status === 'LOCKED')) {
        extra.push('08:29:58 인데 잠겨 있지 않음');
      }
      const early = await book('b1', 's1', newPhone());
      if (early.ok) extra.push('08:29:58 에 예약이 통과됨');
      at('2026-09-18T23:30:00.300Z'); // KST 08:30:00.3 — 직전 응답의 5초 캐시 안쪽
      const after = await invoke('getBoothSessions', { boothId: 'b1' });
      const locked = after.result.sessions.filter((item) => item.status === 'LOCKED').length;
      if (locked > 0) extra.push(`08:30:00 인데 아직 🔒 ${locked}개 (캐시가 정각을 넘김)`);
      // 정각 직후 100명이 동시에 — 열리자마자 몰려도 정원만큼만
      const rush = await Promise.all(Array.from({ length: 100 }, () => book('b1', 's1', newPhone())));
      if (rush.filter((r) => r.ok).length !== 6) extra.push(`정각 러시 성공 ${rush.filter((r) => r.ok).length} ≠ 6`);
      return { results: rush, extra };
    } finally {
      Date.now = realNow;
      reloadFunctions(); // 가짜 시각으로 채워진 캐시가 다음 시나리오에 남지 않게
    }
  },
  async '오픈 러시 — 320명이 4개 부스에 동시에'() {
    seed();
    const jobs = [];
    for (let i = 0; i < 320; i += 1) {
      jobs.push(book(`b${(i % 4) + 1}`, SLOT_IDS[Math.floor(Math.random() * 4)], newPhone()));
    }
    return { results: await Promise.all(jobs), expectOk: 4 * 4 * 6 };
  },
  async '한 부스 집중 — 120명이 같은 부스 4개 회차에'() {
    seed();
    const jobs = [];
    for (let i = 0; i < 120; i += 1) jobs.push(book('b1', SLOT_IDS[i % 4], newPhone()));
    return { results: await Promise.all(jobs), expectOk: 4 * 6 };
  },
  async '마지막 한 자리 — 60명이 1석을 두고'() {
    seed({ capacity: 1 });
    const jobs = [];
    for (let i = 0; i < 60; i += 1) jobs.push(book('b1', 's1', newPhone()));
    return { results: await Promise.all(jobs), expectOk: 1 };
  },
  async '따닥 더블탭 — 80명이 같은 요청을 3번씩'() {
    seed({ capacity: 500 });
    const jobs = [];
    for (let i = 0; i < 80; i += 1) {
      const phone = newPhone();
      const boothId = `b${(i % 4) + 1}`;
      for (let tap = 0; tap < 3; tap += 1) jobs.push(book(boothId, 's1', phone));
    }
    return { results: await Promise.all(jobs), expectOk: 80 };
  },
  async '같은 번호로 여러 부스 동시 예약 — 60명 × 부스 4곳'() {
    seed({ capacity: 500 });
    const jobs = [];
    for (let i = 0; i < 60; i += 1) {
      const phone = newPhone();
      for (let b = 1; b <= 4; b += 1) jobs.push(book(`b${b}`, 's2', phone));
    }
    return { results: await Promise.all(jobs), expectOk: 60 };
  },
  async '형제 동시 예약 — 보호자 60명이 같은 번호로 자녀 2명을 따닥 2번씩'() {
    seed({ capacity: 500 });
    const jobs = [];
    for (let i = 0; i < 60; i += 1) {
      const phone = newPhone();
      const boothId = `b${(i % 4) + 1}`;
      for (const child of ['첫째', '둘째']) {
        // 절반은 같은 회차, 절반은 다른 부스 — 이름이 다르면 둘 다 잡혀야 한다
        const target = i % 2 === 0 || child === '첫째' ? boothId : `b${((i + 1) % 4) + 1}`;
        for (let tap = 0; tap < 2; tap += 1) jobs.push(book(target, 's3', phone, `${child}${i}`));
      }
    }
    return { results: await Promise.all(jobs), expectOk: 120 };
  },
  async '이름 띄어쓰기만 다른 더블탭 — "김 민준" / "김민준" 은 같은 사람'() {
    seed({ capacity: 500 });
    const jobs = [];
    for (let i = 0; i < 60; i += 1) {
      const phone = newPhone();
      jobs.push(book('b1', 's1', phone, `김민준${i}`));
      jobs.push(book('b2', 's1', phone, `김 민준${i}`));
    }
    return { results: await Promise.all(jobs), expectOk: 60 };
  },
  async '미도착 후 재예약 — 같은 부스 다른 회차를 따닥 3번씩'() {
    seed({ capacity: 500 });
    const auth = { uid: 'staff-1' };
    const people = Array.from({ length: 40 }, (_, i) => ({ phone: newPhone(), name: `재도전${i}` }));
    const first = await Promise.all(people.map((p) => book('b1', 's1', p.phone, p.name)));
    // 미도착 처리 전에는 같은 부스 재예약이 막혀야 한다
    const blocked = await Promise.all(people.map((p) => book('b1', 's2', p.phone, p.name)));
    const extra = blocked.some((r) => r.ok) ? ['미도착 처리 전인데 같은 부스 재예약이 통과됨'] : [];
    await Promise.all(
      first.map((r) =>
        invoke(
          'changeReservationStatus',
          { reservationId: r.result.reservation.id, nextStatus: 'NO_SHOW', actionLabel: '미도착' },
          auth,
        ),
      ),
    );
    const jobs = [];
    for (const p of people) {
      for (let tap = 0; tap < 3; tap += 1) jobs.push(book('b1', 's2', p.phone, p.name));
    }
    return { results: await Promise.all(jobs), expectOk: 40, extra };
  },
  async '미도착 자리는 계속 마감 — 미도착 처리 순간 50명이 눌러도 0명, 취소하면 1명'() {
    seed({ capacity: 1 });
    const auth = { uid: 'staff-1' };
    const holder = await book('b1', 's1', newPhone(), '미도착자');
    const reservationId = holder.result.reservation.id;
    const rush = () =>
      Promise.all(
        Array.from({ length: 50 }, () => sleep(rand(0, 400)).then(() => book('b1', 's1', newPhone()))),
      );
    // 1) 미도착 처리와 같은 순간에 50명 — 자리는 열리면 안 된다
    const [noShow, duringNoShow] = await Promise.all([
      invoke('changeReservationStatus', { reservationId, nextStatus: 'NO_SHOW', actionLabel: '미도착' }, auth),
      rush(),
    ]);
    const extra = [];
    if (!noShow.ok) extra.push('미도착 처리 실패');
    const leaked = duringNoShow.filter((r) => r.ok).length;
    if (leaked > 0) extra.push(`미도착 자리에 ${leaked}명이 예약됨 (마감으로 보여야 함)`);
    const sessions = await invoke('getBoothSessions', { boothId: 'b1' });
    const s1 = sessions.result.sessions.find((item) => item.id === 's1');
    if (s1.status !== 'FULL' || s1.seatsLeft !== 0) {
      extra.push(`참가자 화면이 마감이 아님: ${s1.status} 잔여 ${s1.seatsLeft}`);
    }
    // 2) 늦게 도착 → 도착 확인으로 되살려도 정원 그대로
    const revived = await invoke(
      'changeReservationStatus',
      { reservationId, nextStatus: 'CHECKED_IN', actionLabel: '도착 확인' },
      auth,
    );
    if (!revived.ok) extra.push('미도착 → 도착 확인 되살리기 실패');
    // 3) 부스 운영자 화면에는 취소가 없다 — 총괄 관리자 화면의 「예약 취소」(비상용)만 자리를 연다.
    //    그 순간 동시에 누른 50명 중 1명만 성공해야 한다.
    for (const uid of ['staff-1', 'staff-booth']) {
      const denied = await invoke(
        'changeReservationStatus',
        { reservationId, nextStatus: 'CANCELLED', actionLabel: '예약 취소' },
        { uid },
      );
      const denied2 = await invoke('cancelReservation', { reservationId }, { uid });
      if (denied.ok || denied2.ok) extra.push(`${uid} 가 예약을 취소할 수 있음 (황보예린만 가능해야 함)`);
    }
    const [cancelled, afterCancel] = await Promise.all([
      invoke(
        'changeReservationStatus',
        { reservationId, nextStatus: 'CANCELLED', actionLabel: '예약 취소' },
        { uid: 'staff-yerin' },
      ),
      rush(),
    ]);
    if (!cancelled.ok) extra.push('취소 실패');
    const winners = afterCancel.filter((r) => r.ok).length;
    if (winners > 1) extra.push(`취소로 열린 1석에 ${winners}명이 예약됨`);
    return { results: [...duringNoShow, ...afterCancel], extra };
  },
  async '오픈 러시 XL — 1,000명이 13개 부스에, 3초에 걸쳐 몰리고 5명 중 1명은 따닥'() {
    seed({ booths: 14 });
    const jobs = [];
    for (let i = 0; i < 1000; i += 1) {
      const phone = newPhone();
      const boothId = `b${(i % 13) + 1}`;
      const slotId = SLOT_IDS[Math.floor(Math.random() * 4)];
      const taps = i % 5 === 0 ? 2 : 1;
      const delay = rand(0, 3000);
      for (let tap = 0; tap < taps; tap += 1) {
        jobs.push(sleep(delay + tap * rand(0, 80)).then(() => book(boothId, slotId, phone, `러시${i}`)));
      }
    }
    return { results: await Promise.all(jobs), expectOk: 13 * 4 * 6 };
  },
  async '오픈 러시 인기 쏠림 — 600명 중 70%가 인기 부스 2곳의 첫 회차로'() {
    seed();
    const jobs = [];
    for (let i = 0; i < 600; i += 1) {
      const hot = Math.random() < 0.7;
      const boothId = hot ? `b${(i % 2) + 1}` : `b${(i % 4) + 1}`;
      const slotId = hot ? 's1' : SLOT_IDS[Math.floor(Math.random() * 4)];
      jobs.push(sleep(rand(0, 1500)).then(() => book(boothId, slotId, newPhone())));
    }
    return { results: await Promise.all(jobs) };
  },
  async '조작 시도 — 경로 주입·권한 없는 설정 변경·비로그인 운영 호출'() {
    seed();
    const extra = [];
    const expectDenied = async (label, promise, codes) => {
      const r = await promise;
      if (r.ok || !codes.includes(r.code)) extra.push(`${label}: 막혀야 하는데 ${r.ok ? '성공' : r.code}`);
      return r;
    };
    const results = await Promise.all([
      expectDenied('부스 ID 경로 주입', book('b1/../../staffAssignments/staff-1', 's1', newPhone()), ['invalid-argument']),
      expectDenied('회차 ID 경로 주입', book('b1', '../s1', newPhone()), ['invalid-argument']),
      expectDenied('객체를 ID로 전달', invoke('getBoothSessions', { boothId: { $ne: null } }), ['invalid-argument']),
      expectDenied(
        '부스 팀장이 정원 변경',
        invoke('updateBoothSettings', { boothId: 'b1', capacity: 999 }, { uid: 'staff-booth' }),
        ['permission-denied'],
      ),
      expectDenied(
        '본부 관리자도 정원 변경 불가',
        invoke('updateBoothSettings', { boothId: 'b1', capacity: 999 }, { uid: 'staff-yerin' }),
        ['permission-denied'],
      ),
      expectDenied(
        '부스 팀장이 현장코드 변경',
        invoke('updateBoothSettings', { boothId: 'b1', accessCode: '1111' }, { uid: 'staff-booth' }),
        ['permission-denied'],
      ),
      expectDenied(
        '부스 팀장이 남의 부스 회차 중지',
        invoke('updateBoothSettings', { boothId: 'b2', slotId: 's1', bookingOpen: false }, { uid: 'staff-booth' }),
        ['permission-denied'],
      ),
      expectDenied(
        '비로그인 상태 변경',
        invoke('changeReservationStatus', { reservationId: 'x', nextStatus: 'CHECKED_IN' }),
        ['unauthenticated'],
      ),
      expectDenied(
        '비로그인 현장 추가',
        invoke('staffAddReservation', { boothId: 'b1', slotId: 's1', participantName: '침입자' }),
        ['unauthenticated'],
      ),
      expectDenied(
        '등록 안 된 계정의 운영 호출',
        invoke('staffAddReservation', { boothId: 'b1', slotId: 's1', participantName: '침입자' }, { uid: 'ghost' }),
        ['permission-denied'],
      ),
    ]);
    if (db.docs.get('booths/b1').data.capacity !== 6) extra.push('정원이 바뀌어 버림');
    // 막힌 시도는 정상 거절이므로 시스템 오류로 세지 않는다
    return { results: results.map((r) => ({ ...r, code: r.ok ? r.code : 'blocked' })), extra };
  },
  async '예약 러시 중 운영자 조작 — 도착확인·미도착·현장추가·회차중지'() {
    seed();
    const auth = { uid: 'staff-1' };
    // 미리 예약 12건을 만들어 두고, 러시와 동시에 운영자가 상태를 바꾼다
    const pre = await Promise.all(
      Array.from({ length: 12 }, (_, i) => book('b1', SLOT_IDS[i % 2], newPhone())),
    );
    const ids = pre.filter((r) => r.ok).map((r) => r.result.reservation.id);
    const jobs = [];
    for (let i = 0; i < 80; i += 1) jobs.push(book('b1', SLOT_IDS[i % 4], newPhone()));
    const staffJobs = [];
    ids.forEach((reservationId, i) => {
      staffJobs.push(
        invoke(
          'changeReservationStatus',
          { reservationId, nextStatus: i % 3 === 0 ? 'NO_SHOW' : 'CHECKED_IN', actionLabel: '시뮬' },
          auth,
        ),
      );
    });
    for (let i = 0; i < 6; i += 1) {
      staffJobs.push(
        invoke('staffAddReservation', { boothId: 'b1', slotId: SLOT_IDS[i % 4], participantName: `현장${i}` }, auth),
      );
    }
    staffJobs.push(invoke('updateBoothSettings', { boothId: 'b1', slotId: 's4', bookingOpen: false }, auth));
    const [results, staffResults] = await Promise.all([Promise.all(jobs), Promise.all(staffJobs)]);
    const closed = db.docs.get('booths/b1').data.slots.find((s) => s.id === 's4').bookingOpen;
    const extra = closed === false ? [] : ['회차 중지(bookingOpen=false)가 다른 쓰기에 덮여 사라짐'];
    return { results: [...results, ...staffResults], staffAddedAllowed: true, extra };
  },
  async '현장등록 따닥 — 60명이 같은 등록을 3번씩'() {
    seed();
    const jobs = [];
    for (let i = 0; i < 60; i += 1) {
      const phone = newPhone();
      for (let tap = 0; tap < 3; tap += 1) {
        jobs.push(
          invoke('createWalkInRegistration', {
            boothId: 'b5',
            participantName: `현장${i}`,
            phone,
            phoneConfirm: phone,
            gradeOrAge: '초2',
            gender: 'FEMALE',
          }),
        );
      }
    }
    return { results: await Promise.all(jobs) };
  },
};

// ---------------------------------------------------------------- run
(async () => {
  console.log(`동시 예약 시뮬레이션 — 시나리오 ${Object.keys(scenarios).length}개 × ${repeat}회\n`);
  let failedScenarios = 0;
  for (const [title, run] of Object.entries(scenarios)) {
    if (process.env.SIM_ONLY && !title.includes(process.env.SIM_ONLY)) continue; // 예: SIM_ONLY=정각
    const allProblems = new Map();
    let systemErrors = 0;
    let last = null;
    let aborts = 0;
    for (let round = 0; round < repeat; round += 1) {
      const { results, expectOk, staffAddedAllowed, extra = [] } = await run();
      const summary = summarize(results);
      const { problems } = audit({ staffAddedAllowed });
      if (expectOk !== undefined && summary.ok !== expectOk) {
        problems.push(`성공 건수 ${summary.ok} ≠ 기대 ${expectOk}`);
      }
      for (const problem of [...problems, ...extra]) {
        const key = problem.replace(/\d+/g, '#');
        allProblems.set(key, { sample: problem, count: (allProblems.get(key)?.count ?? 0) + 1 });
      }
      systemErrors += Object.entries(summary.codes)
        .filter(([code]) => SYSTEM_CODES.includes(code) || SYSTEM_CODES.includes(Number(code)))
        .reduce((sum, [, count]) => sum + count, 0);
      aborts += db.stats.aborts;
      last = summary;
    }
    const pass = allProblems.size === 0 && systemErrors === 0;
    if (!pass) failedScenarios += 1;
    console.log(`${pass ? '✅' : '❌'} ${title}`);
    console.log(
      `   마지막 회차: 성공 ${last.ok} · 거절/오류 ${JSON.stringify(last.codes)} · ` +
        `p50 ${(last.p50 / 1000).toFixed(1)}s p95 ${(last.p95 / 1000).toFixed(1)}s max ${(last.max / 1000).toFixed(1)}s (가상 시간)`,
    );
    console.log(`   트랜잭션 재시도(ABORT) 합계 ${aborts} · 시스템 오류 ${systemErrors}건`);
    for (const { sample, count } of allProblems.values()) console.log(`   ⚠ ${sample}  (${count}건 유형)`);
  }
  console.error = originalConsoleError;
  console.log(failedScenarios === 0 ? '\n판정: 전부 통과' : `\n판정: ${failedScenarios}개 시나리오에서 문제 발견`);
  process.exit(failedScenarios === 0 ? 0 : 1);
})();
