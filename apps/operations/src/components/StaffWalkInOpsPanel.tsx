import { useEffect, useMemo, useState } from 'react';
import type { WalkInBoothPublicStatus, WalkInRegistration } from '@bgf/shared';
import {
  OPERATION_MODE_LABELS,
  WALK_IN_PUBLIC_STATUS_LABELS,
  filterBoothWalkInsToday,
  getWalkInRegistrationStatistics,
  setWalkInBoothPublicStatus,
  subscribeWalkInsForBooth,
  type Booth,
} from '@bgf/shared';

function formatClock(iso: string): string {
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes(),
  ).padStart(2, '0')}`;
}

const STATUS_OPTIONS: WalkInBoothPublicStatus[] = [
  'OPEN',
  'PAUSED',
  'PREPARING',
  'CLOSED',
];

interface StaffWalkInOpsPanelProps {
  booth: Booth;
}

export function StaffWalkInOpsPanel({ booth }: StaffWalkInOpsPanelProps) {
  const [rows, setRows] = useState<WalkInRegistration[]>([]);
  const [statusPending, setStatusPending] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    return subscribeWalkInsForBooth(booth.id, setRows);
  }, [booth.id]);

  const stats = useMemo(
    () => getWalkInRegistrationStatistics(booth, rows),
    [booth, rows],
  );
  const todayRows = useMemo(
    () => filterBoothWalkInsToday(booth.id, rows),
    [booth.id, rows],
  );

  async function changeStatus(status: WalkInBoothPublicStatus) {
    setStatusPending(true);
    setMessage('');
    const result = await setWalkInBoothPublicStatus(booth.id, status);
    setStatusPending(false);
    if (!result.ok) {
      setMessage(result.message);
    }
  }

  return (
    <>
      <section className="glass-card staff-hero">
        <span className="mode-badge mode-walkin">
          {OPERATION_MODE_LABELS.WALK_IN_CHECKIN}
        </span>
        <h2>
          부스 {booth.number} {booth.name}
        </h2>
        <p className="hint-text">현장 참여 집계 · 호출/대기 기능 없음 · 정원 제한 없음</p>
        <div className="status-row">
          <span className="status-chip confirmed active">
            오늘 {stats.totalToday}
          </span>
          <span className="status-chip arrived active">
            오전 {stats.morningCount}
          </span>
          <span className="status-chip inprogress active">
            오후 {stats.afternoonCount}
          </span>
          <span className="status-chip done active">
            현재 시간대 {stats.currentHourCount}
          </span>
          <span
            className={`status-chip noshow${stats.duplicateBlockCount > 0 ? ' active' : ''}`}
          >
            중복 차단 {stats.duplicateBlockCount}
          </span>
        </div>
        <p className="admin-meta">
          현장 등록 상태:{' '}
          {WALK_IN_PUBLIC_STATUS_LABELS[stats.publicStatus]}
        </p>
      </section>

      <section className="glass-card">
        <h3 className="section-title">현장 등록 운영 상태</h3>
        <div className="choice-row">
          {STATUS_OPTIONS.map((status) => (
            <button
              key={status}
              type="button"
              className={`choice-chip${stats.publicStatus === status ? ' selected' : ''}`}
              disabled={statusPending}
              onClick={() => void changeStatus(status)}
            >
              {WALK_IN_PUBLIC_STATUS_LABELS[status]}
            </button>
          ))}
        </div>
        {message ? <p className="error-text">{message}</p> : null}
      </section>

      <section className="glass-card">
        <h3 className="section-title">최근 등록 참가자</h3>
        {todayRows.length === 0 ? (
          <div className="empty-state">오늘 등록된 참가자가 없습니다.</div>
        ) : (
          <ul className="plain-list">
            {todayRows.slice(0, 40).map((item) => (
              <li key={item.id}>
                <strong>{item.participantName}</strong> · 뒤 {item.phoneLastFour}{' '}
                · {item.maskedPhone}
                {item.gender
                  ? ` · ${item.gender === 'MALE' ? '남' : '여'}`
                  : ''}{' '}
                · #{item.confirmationNumber} · {formatClock(item.createdAt)} ·{' '}
                {item.status}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
