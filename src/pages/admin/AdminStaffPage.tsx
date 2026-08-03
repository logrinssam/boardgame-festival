import { Link } from 'react-router-dom';
import { getBoothById } from '../../data/boothData';
import { SCHEDULE_SLOTS, formatTimeRange } from '../../data/scheduleData';
import {
  BOOTH_STAFFING,
  HEADQUARTERS_STAFFING,
  STAFFING_SUMMARIES,
  formatRoles,
} from '../../data/staffScheduleData';
import { STAFF_ASSIGNMENTS } from '../../data/staffAssignments';
import { EXPERIENCE_GROUP_LABELS } from '../../types';

export function AdminStaffPage() {
  return (
    <>
      <div className="page-heading">
        <h2>운영인력 · 권한</h2>
        <p>
          A~E는 회차 근무 역할이며 로그인 권한이 아닙니다. 권한은
          StaffAssignment로 관리합니다.
        </p>
      </div>

      <section className="glass-card">
        <h3 className="section-title">로그인 권한 배정 (mock)</h3>
        {STAFF_ASSIGNMENTS.map((item) => (
          <div key={item.uid} className="staff-summary">
            <strong>{item.name}</strong>
            <p className="admin-meta">
              {item.role}
              {item.experienceGroup
                ? ` · ${EXPERIENCE_GROUP_LABELS[item.experienceGroup]}`
                : ''}
            </p>
            <p className="hint-text">
              담당 부스: {item.assignedBoothIds.join(', ') || '전체'}
            </p>
          </div>
        ))}
      </section>

      <section className="glass-card">
        <h3 className="section-title">본부</h3>
        <ul className="plain-list">
          <li>교사 {HEADQUARTERS_STAFFING.teachers}명</li>
          <li>미래잇다 {HEADQUARTERS_STAFFING.miraeItda}명</li>
        </ul>
        {STAFFING_SUMMARIES.map((summary) => (
          <div key={summary.boothRangeLabel} className="staff-summary">
            <strong>{summary.boothRangeLabel}</strong>
            <p>
              교사 {summary.teachers}명 · 미래잇다 {summary.miraeItda}명
            </p>
            <p className="hint-text">{summary.note}</p>
          </div>
        ))}
      </section>

      {BOOTH_STAFFING.slice(0, 3).map((staffing) => {
        const booth = getBoothById(staffing.boothId);
        if (!booth) return null;
        const sample = staffing.rotations[0];
        const schedule = SCHEDULE_SLOTS.find(
          (slot) => slot.id === sample.slotId,
        );
        return (
          <section key={staffing.boothId} className="glass-card">
            <h3 className="section-title">
              부스 {booth.number} 근무표 예시
            </h3>
            {schedule ? (
              <p>
                {formatTimeRange(schedule.startTime, schedule.endTime)} 운영{' '}
                {formatRoles(sample.activeRoles)} / 휴식{' '}
                {sample.restingRoles.length
                  ? formatRoles(sample.restingRoles)
                  : '없음'}
              </p>
            ) : null}
            <Link to="/admin/settings" className="hint-text">
              전체 근무표는 현장 운영 화면에서 확인
            </Link>
          </section>
        );
      })}
    </>
  );
}
