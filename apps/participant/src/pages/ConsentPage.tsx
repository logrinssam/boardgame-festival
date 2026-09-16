import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '../context/AppStore';
import { EVENT_SCHEDULE, formatTimeRange } from '@bgf/shared';
import { canBookSlot, getGrantedBoothAccessCode } from '@bgf/shared';

interface BookingState {
  boothId?: string;
  slotId?: string;
  accessCode?: string;
}

/** 개인정보(필수) · 초상권(선택) 동의 — 문구는 행사 동의서 양식과 맞춘다 */
export function ConsentPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as BookingState | null) ?? {};
  const { getBooth, getSlot } = useAppStore();
  const booth = state.boothId ? getBooth(state.boothId) : undefined;
  const slot =
    state.boothId && state.slotId
      ? getSlot(state.boothId, state.slotId)
      : undefined;
  const [privacyAgreed, setPrivacyAgreed] = useState(false);
  const [portraitAgreed, setPortraitAgreed] = useState(false);

  if (!booth || !slot) {
    return (
      <div className="glass-card">
        <p>예약 세션이 없습니다.</p>
        <Link to="/" className="btn btn-primary">
          홈으로
        </Link>
      </div>
    );
  }

  const bookable = canBookSlot(booth, slot);
  if (!bookable.allowed) {
    return (
      <div className="glass-card notice warning">
        <p>{bookable.reason}</p>
        <Link to={`/booths/${booth.id}/slots`} className="btn btn-primary">
          회차 다시 선택
        </Link>
      </div>
    );
  }

  return (
    <section className="glass-card">
      <h2 className="section-title">개인정보 및 초상권 제공 동의</h2>
      <p className="hint-text">
        {booth.name} · {formatTimeRange(slot.startTime, slot.endTime)}
      </p>
      <p className="consent-intro">
        본인은 개인정보보호법 제15조(개인정보의 수집·이용) 등 관련 법령에 따라,
        아래의 목적과 범위 내에서 본인의 개인정보 및 초상(사진·영상 등)이
        수집·이용·제공되는 것에 동의합니다.
      </p>

      <div className="consent-block">
        <h3 className="consent-title">
          1. 개인정보 제공 및 활용 <span className="consent-required">필수</span>
        </h3>
        <dl className="consent-list">
          <div>
            <dt>제공 목적</dt>
            <dd>「{EVENT_SCHEDULE.title}」 행사 운영</dd>
          </div>
          <div>
            <dt>제공 항목</dt>
            <dd>신청서에 기재된 내역 일체 (참가자 이름, 보호자 연락처, 성별, 학년/연령)</dd>
          </div>
          <div>
            <dt>보유·이용 기간</dt>
            <dd>행사 종료 후 즉시 파기</dd>
          </div>
        </dl>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={privacyAgreed}
            onChange={(event) => setPrivacyAgreed(event.target.checked)}
          />
          <span>개인정보 수집·이용에 동의합니다. (필수)</span>
        </label>
      </div>

      <div className="consent-block">
        <h3 className="consent-title">
          2. 초상권 활용 <span className="consent-optional">선택</span>
        </h3>
        <dl className="consent-list">
          <div>
            <dt>활용 목적</dt>
            <dd>행사 홍보, 교육 및 기록 자료 공유</dd>
          </div>
          <div>
            <dt>활용 매체</dt>
            <dd>행사 관련 공식 SNS 계정, 유튜브 채널, 홍보자료(온라인·오프라인 포함)</dd>
          </div>
          <div>
            <dt>활용 범위</dt>
            <dd>초상(사진·영상), 성명(필요 시), 인터뷰 내용</dd>
          </div>
          <div>
            <dt>활용 기간</dt>
            <dd>행사 홍보 및 기록 자료로서 게시물 유지 기간 동안</dd>
          </div>
          <div>
            <dt>기타 사항</dt>
            <dd>
              동의는 자발적으로 이루어졌으며, 게시 전까지는 철회 가능하나 이미
              게시·배포된 자료에 대해서는 철회가 불가함
            </dd>
          </div>
        </dl>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={portraitAgreed}
            onChange={(event) => setPortraitAgreed(event.target.checked)}
          />
          <span>초상권 활용에 동의합니다. (선택)</span>
        </label>
        <p className="hint-text consent-note">
          초상권에 동의하지 않아도 예약할 수 있어요. 동의하지 않으면 사진·영상에
          참가자가 나오지 않도록 운영진이 확인합니다.
        </p>
      </div>

      <button
        type="button"
        className="btn btn-primary"
        disabled={!privacyAgreed}
        onClick={() =>
          navigate('/booking/participant', {
            state: {
              boothId: booth.id,
              slotId: slot.id,
              accessCode:
                state.accessCode ||
                getGrantedBoothAccessCode(booth.id) ||
                undefined,
              portraitConsent: portraitAgreed,
            },
          })
        }
      >
        다음
      </button>
    </section>
  );
}
