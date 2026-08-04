import type { SlotAvailabilityStatus } from '@bgf/shared';
import { getSlotStatusLabel } from '@bgf/shared';

interface StatusBadgeProps {
  status: SlotAvailabilityStatus | 'READY' | 'CAPACITY_PENDING' | string;
  label?: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const text =
    label ??
    (status === 'READY'
      ? '운영 가능'
      : status === 'CAPACITY_PENDING'
        ? '예약 준비 중'
        : getSlotStatusLabel(status as SlotAvailabilityStatus));

  return (
    <span className={`status-badge status-${String(status).toLowerCase()}`}>
      {text}
    </span>
  );
}
