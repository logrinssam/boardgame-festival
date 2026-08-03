import { Link } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { getBoothById } from '../data/boothData';
import { SCHEDULE_SLOTS, formatTimeRange } from '../data/scheduleData';
import {
  BOOTH_STAFFING,
  HEADQUARTERS_STAFFING,
  STAFFING_SUMMARIES,
  formatRoles,
} from '../data/staffScheduleData';

export function AdminStaffPage() {
  return (
    <AppShell
      title="운영인력"
      subtitle="역할 A~E는 운영 구분이며 참가자 화면에 노출되지 않습니다."
      showBack
      backTo="/admin"
      footer={
        <nav className="bottom-nav">
          <Link to="/admin" className="nav-item">
            운영 현황
          </Link>
          <Link to="/admin/staff" className="nav-item active">
            운영인력
          </Link>
          <Link to="/" className="nav-item">
            참가자 홈
          </Link>
        </nav>
      }
    >
      <section className="glass-card">
        <h3 className="section-title">본부</h3>
        <ul className="plain-list">
          <li>교사 {HEADQUARTERS_STAFFING.teachers}명</li>
          <li>미래잇다 {HEADQUARTERS_STAFFING.miraeItda}명</li>
        </ul>
      </section>

      <section className="glass-card">
        <h3 className="section-title">인력 요약</h3>
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

      {BOOTH_STAFFING.map((staffing) => {
        const booth = getBoothById(staffing.boothId);
        if (!booth) return null;

        return (
          <section key={staffing.boothId} className="glass-card staff-booth-card">
            <div className="detail-row">
              <h3 className="section-title">
                부스 {booth.number}. {booth.name}
              </h3>
              <span className="pill">
                {staffing.staffingType === 'FIXED_STAFF'
                  ? '고정 운영'
                  : staffing.staffingType === 'THREE_PERSON_ROTATION'
                    ? '3인 순환'
                    : '4인 순환'}
              </span>
            </div>

            <p className="hint-text">
              역할: {formatRoles(staffing.roles)} · 실제 담당자 이름은 추후 입력
            </p>

            <div className="staff-rotation-scroll">
              {staffing.rotations.map((rotation) => {
                const schedule = SCHEDULE_SLOTS.find(
                  (slot) => slot.id === rotation.slotId,
                );
                if (!schedule) return null;
                return (
                  <article key={rotation.slotId} className="staff-rotation-card">
                    <strong>
                      부스 {booth.number} /{' '}
                      {formatTimeRange(schedule.startTime, schedule.endTime)}
                    </strong>
                    <p>운영: {formatRoles(rotation.activeRoles)}</p>
                    <p>
                      휴식:{' '}
                      {rotation.restingRoles.length > 0
                        ? formatRoles(rotation.restingRoles)
                        : '없음'}
                    </p>
                    <p className="hint-text">
                      담당자:{' '}
                      {rotation.activeRoles
                        .map((role) => {
                          const name = staffing.roleAssignments[role];
                          return name ? `${role}(${name})` : `${role}(미정)`;
                        })
                        .join(', ')}
                    </p>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </AppShell>
  );
}
