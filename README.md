# 제4회 창의융합 보드게임 대축제

참여자용 웹앱과 운영·관리자용 웹앱을 분리한 npm workspaces 모노레포입니다.

## 구조

```text
apps/
  participant/   # 부스 현황 · 예약 · 내 예약
  operations/    # 부스 운영자 · 영역/본부 관리자
packages/
  shared/        # 타입 · 부스/회차 데이터 · 예약 유틸
```

## 개발

```bash
npm install
npm run dev:participant   # http://localhost:5173
npm run dev:operations    # http://localhost:5174
```

## 빌드

```bash
npm run build
```

결과물:

- `dist/` — 참여자 앱 (`/boardgame-festival/`)
- `dist/ops/` — 운영 앱 (`/boardgame-festival/ops/`)

## 운영자 로그인

이름(동명이인은 `부스N`) + 개별 PIN 6자리. PIN 은 `npm run rotate:staff-pins -- --apply` 로
발급·교체하며 결과는 `staff-pins.local.csv`(git 제외)에만 남는다. 공용 PIN 은 없다.

## 보안 운영 규칙

이 저장소는 **공개**다. 현장코드·PIN·전화번호 같은 값은 절대 커밋하지 않는다.

- 부스 현장코드는 Firestore `boothSecrets/{boothId}` 에만 있다 (본부 전체 / 팀장은 담당 부스만 읽기).
  참가자가 읽는 `booths` 문서에는 코드 유무(`accessCodeConfigured`)만 있다.
  - 코드 확인: 운영 앱 > 부스 관리(본부) / 부스 운영 화면(팀장)
  - 일괄 교체: `npm run migrate:access-codes -- --apply --rotate` → `access-codes.local.csv`
- 예약·현장등록·회차 판정·현장코드 비교는 전부 Cloud Functions 가 한다. 클라이언트는 표시만.
- 비로그인 콜러블(`getMyReservations` 등)은 전화번호를 알아야만 조회된다. 현장 등록 확인 화면은 마스킹 번호만 받는다.
- Firebase 콘솔에서 추가로 켜 둘 것 (코드로는 못 함):
  1. **App Check** (reCAPTCHA v3) — 스크립트로 예약을 대량 생성하거나 코드를 무작위 대입하는 것을 막는다.
  2. **Authentication > 설정 > 이메일 열거 보호** 켜기.
  3. **Google Cloud > API 키** 의 웹 키에 HTTP 리퍼러 제한: `logrinssam.github.io/*`, `localhost:*`.
- 규칙 변경 후 배포: `npx firebase-tools deploy --only firestore:rules`

## 동시접속 대비

- Functions: 인스턴스당 80 요청 동시 처리 × 최대 40 인스턴스. 참가자 콜러블
  (`getSiteStatus`, `getBoothSessions`, `createReservation`)은 `minInstances: 1` 로 콜드 스타트를 피한다.
- `getBoothSessions` 는 부스별 5초 캐시, 점검 시계 설정은 10초 캐시 — 폴링 읽기 비용을 줄인다.
- 예약 트랜잭션은 부스 문서 충돌 시 최대 8회 재시도한다.
- 부하 테스트(읽기 전용, 예약 생성 없음):

```bash
npm run load-test -- 300 3     # 동시 300명 × 3라운드
npm run load-test -- 1000 2
```

  합격 기준: 오류 0건, p95 2초 미만. 넘으면 `functions/src/index.ts` 의 `minInstances`/`maxInstances` 를 올린다.

## 오픈 일정 (KST)

| 날짜 | 참여자 사이트 |
|---|---|
| ~ 9/17 | 잠금 화면만 표시 (오픈 안내) |
| 9/18 (금) | 사이트 오픈 — 부스 둘러보기 가능, 회차는 전부 🔒 |
| 9/19 (토) 행사일 | 오전 회차 08:30 · 오후 회차 12:45 자동 오픈 |
| 9/20 ~ | 전 회차 종료 |

날짜·시각 판정은 전부 서버(`functions/src/lib.ts`)가 하고, 잠금 화면(`SiteGate`)은
기기 시계로 "아직"이라고 보일 때만 서버(`getSiteStatus`)에 한 번 더 확인한다.
날짜를 바꾸려면 `packages/shared/src/data/scheduleData.ts`의 `EVENT_SCHEDULE`과
`functions/src/lib.ts`의 `SITE_OPEN_DATE` / `EVENT_DATE`를 함께 고치고 Functions를 재배포한다.

## 점검(테스트) 모드

행사 전 예약 시나리오를 점검하려면 서버 시각을 흉내 내는 가상 시계를 쓴다.
예약 오픈/마감 판정은 전부 서버가 하므로 **기기 시간을 바꾸는 것은 효과가 없다.**
점검 모드가 켜져 있는 동안 서버는 **행사 당일(9/19)로 취급**하므로 잠금 화면도 건너뛴다.

```bash
npm run test-clock 08:29      # 서버가 08:29 기준으로 동작 (기본 2시간 후 자동 해제)
npm run test-clock 12:46 30   # 12:46 기준, 30분 후 자동 해제
npm run test-clock open 2026-09-02   # 그날 자정(KST)까지 모든 회차 상시 개방
npm run test-clock status     # 현재 상태 확인
npm run test-clock off        # 즉시 해제
```

켜져 있는 동안 참여자 화면 상단에 빨간 **점검 모드** 배너가 뜬다.
`expiresAt`이 지나면 서버가 설정을 무시하고 실제 시각으로 돌아가므로,
끄는 것을 잊어도 행사 당일 사고로 이어지지 않는다.

### 점검 시나리오

| 가상 시각 | 기대 결과 |
|---|---|
| `08:29` | 13개 회차 전부 잠김 (🔒 오픈 시각 표시) |
| `08:31` | 오전 6회차 열림, 오후 7회차 잠김 |
| `12:44` | 오후 여전히 잠김 |
| `12:46` | 오후 열림 |
| `14:05` | 14:00까지 종료 처리, 14:30부터 예약 가능 |

화면에서 막히는 것은 안내일 뿐이므로, 비활성 회차로 예약 API를 직접 호출해
서버가 거절하는지도 함께 확인한다.

> 점검이 끝나면 `npm run test-clock off` 로 반드시 해제하고,
> QA용 예약 문서가 남아 있으면 행사 전에 정리한다.
