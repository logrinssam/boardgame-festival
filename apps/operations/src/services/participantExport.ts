import type { Booth, Reservation, WalkInRegistration } from '@bgf/shared';
import {
  EXPERIENCE_GROUP_LABELS,
  PARTICIPANT_GENDER_LABELS,
  RESERVATION_STATUS_LABELS,
  formatTimeRange,
} from '@bgf/shared';

const HEADERS = [
  '구분',
  '부스 번호',
  '부스 이름',
  '체험 분류',
  '체험 시간',
  '이름',
  '연락처',
  '학년·나이',
  '성별',
  '상태',
  '초상권 동의',
  '예약·확인 번호',
  '신청 시각',
  '마지막 변경 시각',
];

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  // 서울 지역번호(02)는 두 자리
  if (digits.startsWith('02') && (digits.length === 9 || digits.length === 10)) {
    return `02-${digits.slice(2, -4)}-${digits.slice(-4)}`;
  }
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function csvCell(value: string | number): string {
  let text = String(value);
  // 엑셀이 수식으로 실행하지 않도록 막는다 (참가자가 입력한 값이 그대로 들어가므로)
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function buildParticipantCsv(input: {
  booths: Booth[];
  reservations: Reservation[];
  walkIns: WalkInRegistration[];
}): { csv: string; rowCount: number } {
  const boothById = new Map(input.booths.map((booth) => [booth.id, booth]));

  const rows: Array<{ sortKey: string; cells: Array<string | number> }> = [];

  for (const item of input.reservations) {
    const booth = boothById.get(item.boothId);
    const slot = booth?.slots.find((candidate) => candidate.id === item.slotId);
    rows.push({
      sortKey: `${String(booth?.number ?? 999).padStart(3, '0')}|${slot?.startTime ?? ''}|${item.createdAt}`,
      cells: [
        '시간 예약',
        booth?.number ?? '',
        booth?.name ?? item.boothId,
        booth ? EXPERIENCE_GROUP_LABELS[booth.experienceGroup] : '',
        slot ? formatTimeRange(slot.startTime, slot.endTime) : '',
        item.participantName,
        formatPhone(item.phone),
        item.gradeOrAge,
        item.gender ? PARTICIPANT_GENDER_LABELS[item.gender] : '',
        RESERVATION_STATUS_LABELS[item.status],
        item.portraitConsent ? '동의' : '미동의',
        item.reservationCode,
        formatDateTime(item.createdAt),
        formatDateTime(item.updatedAt),
      ],
    });
  }

  for (const item of input.walkIns) {
    const booth = boothById.get(item.boothId);
    rows.push({
      sortKey: `${String(booth?.number ?? 999).padStart(3, '0')}||${item.createdAt}`,
      cells: [
        '현장 등록',
        booth?.number ?? '',
        booth?.name ?? item.boothId,
        booth ? EXPERIENCE_GROUP_LABELS[booth.experienceGroup] : '',
        '',
        item.participantName,
        formatPhone(item.phone),
        item.gradeOrAge ?? '',
        item.gender ? PARTICIPANT_GENDER_LABELS[item.gender] : '',
        item.status === 'CANCELLED' ? '등록 취소' : '등록',
        item.portraitConsent ? '동의' : '미동의',
        item.confirmationNumber,
        formatDateTime(item.createdAt),
        formatDateTime(item.cancelledAt),
      ],
    });
  }

  rows.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  const lines = [HEADERS, ...rows.map((row) => row.cells)].map((cells) =>
    cells.map(csvCell).join(','),
  );
  // BOM이 있어야 엑셀에서 한글이 깨지지 않는다
  return { csv: `﻿${lines.join('\r\n')}`, rowCount: rows.length };
}

export function downloadCsv(csv: string, fileName: string): void {
  const url = URL.createObjectURL(
    new Blob([csv], { type: 'text/csv;charset=utf-8' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
