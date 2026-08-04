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
