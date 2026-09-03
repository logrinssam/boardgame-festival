/**
 * 읽기 전용 부하 테스트 — 행사 당일 동시 접속을 흉내 낸다.
 *
 * 참가자 앱이 실제로 때리는 두 콜러블만 호출한다 (예약은 만들지 않는다):
 *   getSiteStatus      — 첫 화면 잠금 확인
 *   getBoothSessions   — 부스 상세/회차 선택 화면 (30초마다 폴링)
 *
 * 사용:
 *   node scripts/load-test.mjs                # 동시 100명 × 3라운드
 *   node scripts/load-test.mjs 300 5          # 동시 300명 × 5라운드
 *   node scripts/load-test.mjs 1000 2
 *
 * 비용: getBoothSessions 1회 ≈ Firestore 읽기 수십 건. 1000×5 라운드 ≈ 수십만 읽기(≈ $0.2).
 * 판정: 오류 0건, p95 < 2초면 합격. p95 가 3초를 넘거나 오류가 나오면 minInstances 를 올린다.
 */
const concurrency = Number(process.argv[2] ?? 100);
const rounds = Number(process.argv[3] ?? 3);
const base = 'https://asia-northeast3-boardgame-a06d1.cloudfunctions.net';
const boothIds = Array.from({ length: 14 }, (_, i) => `booth-${String(i + 1).padStart(2, '0')}`);

if (!Number.isFinite(concurrency) || concurrency < 1 || concurrency > 3000) {
  console.error('동시 접속 수는 1~3000 사이여야 합니다.');
  process.exit(1);
}

async function call(name, data) {
  const started = performance.now();
  try {
    const res = await fetch(`${base}/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data }),
    });
    const ms = performance.now() - started;
    if (!res.ok) return { ok: false, ms, status: res.status };
    const json = await res.json();
    return { ok: !json.error, ms, status: res.status };
  } catch (error) {
    return { ok: false, ms: performance.now() - started, status: String(error?.code ?? error) };
  }
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

console.log(`동시 ${concurrency}명 × ${rounds}라운드 (읽기 전용) 시작…\n`);
const all = [];
for (let round = 1; round <= rounds; round += 1) {
  const roundStart = performance.now();
  const results = await Promise.all(
    Array.from({ length: concurrency }, (_, i) =>
      // 절반은 첫 화면, 절반은 부스 회차 조회 — 실제 화면 비율에 가깝게
      i % 2 === 0
        ? call('getSiteStatus', {})
        : call('getBoothSessions', { boothId: boothIds[i % boothIds.length] }),
    ),
  );
  const elapsed = (performance.now() - roundStart) / 1000;
  const errors = results.filter((r) => !r.ok);
  const sorted = results.map((r) => r.ms).sort((a, b) => a - b);
  console.log(
    `라운드 ${round}: ${results.length}건 / ${elapsed.toFixed(1)}s (${(results.length / elapsed).toFixed(0)} req/s)  ` +
      `p50 ${percentile(sorted, 50).toFixed(0)}ms  p95 ${percentile(sorted, 95).toFixed(0)}ms  max ${sorted.at(-1).toFixed(0)}ms  오류 ${errors.length}`,
  );
  if (errors.length > 0) {
    const byStatus = {};
    for (const e of errors) byStatus[e.status] = (byStatus[e.status] ?? 0) + 1;
    console.log('   오류 내역:', JSON.stringify(byStatus));
  }
  all.push(...results);
}

const sorted = all.map((r) => r.ms).sort((a, b) => a - b);
const errors = all.filter((r) => !r.ok).length;
const p95 = percentile(sorted, 95);
console.log(
  `\n합계 ${all.length}건  오류 ${errors}건 (${((errors / all.length) * 100).toFixed(2)}%)  ` +
    `p50 ${percentile(sorted, 50).toFixed(0)}ms  p95 ${p95.toFixed(0)}ms  p99 ${percentile(sorted, 99).toFixed(0)}ms`,
);
console.log(errors === 0 && p95 < 2000 ? '판정: 합격' : '판정: 확인 필요 — functions/src/index.ts 의 minInstances / maxInstances 를 올려 보세요.');
