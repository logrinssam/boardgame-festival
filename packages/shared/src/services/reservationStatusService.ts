import type { ReservationStatus } from '../types';
import { ALLOWED_STATUS_TRANSITIONS } from '../types';

export function canTransition(
  from: ReservationStatus,
  to: ReservationStatus,
): boolean {
  return ALLOWED_STATUS_TRANSITIONS[from].includes(to);
}

export function assertTransition(
  from: ReservationStatus,
  to: ReservationStatus,
): { ok: true } | { ok: false; message: string } {
  if (!canTransition(from, to)) {
    return {
      ok: false,
      message: `${from} 상태에서 ${to}(으)로 변경할 수 없습니다.`,
    };
  }
  return { ok: true };
}

export function getActionsForStatus(
  status: ReservationStatus,
): Array<{ to: ReservationStatus; label: string; tone: string; confirm?: boolean }> {
  switch (status) {
    case 'CONFIRMED':
      return [
        { to: 'CHECKED_IN', label: '도착 확인', tone: 'green' },
        { to: 'NO_SHOW', label: '미도착 처리', tone: 'red', confirm: true },
      ];
    case 'CHECKED_IN':
      return [
        { to: 'IN_PROGRESS', label: '체험 시작', tone: 'blue' },
      ];
    case 'IN_PROGRESS':
      return [{ to: 'COMPLETED', label: '체험 완료', tone: 'green-deep' }];
    case 'NO_SHOW':
      // 미도착 처리 후 늦게 도착한 참가자 — 다시 도착 확인으로 되살린다
      return [
        { to: 'CHECKED_IN', label: '늦게 도착', tone: 'green', confirm: true },
      ];
    default:
      return [];
  }
}
