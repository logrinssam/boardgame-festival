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

## 테스트 운영 계정 (mock)

- ID: `staff`
- PIN: `0000`

## 점검(테스트) 모드

행사 전 예약 시나리오를 점검하려면 서버 시각을 흉내 내는 가상 시계를 쓴다.
예약 오픈/마감 판정은 전부 서버가 하므로 **기기 시간을 바꾸는 것은 효과가 없다.**

```bash
npm run test-clock 08:29      # 서버가 08:29 기준으로 동작 (기본 2시간 후 자동 해제)
npm run test-clock 12:46 30   # 12:46 기준, 30분 후 자동 해제
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
