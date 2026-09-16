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

/**
 * 개인정보 수집·이용 + 초상권 활용 동의 — 둘 다 필수라 체크박스 하나로 묶는다.
 * 문구는 행사 동의서 양식과 같고, 작은 글씨 약관 상자로 보여준다.
 */
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
  const [agreed, setAgreed] = useState(false);

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
      <p className="consent-booth">{booth.name}</p>
      <p className="hint-text">
        {formatTimeRange(slot.startTime, slot.endTime)}
      </p>

      <div className="consent-terms">
        <p>
          본인은 개인정보보호법 제15조(개인정보의 수집·이용) 등 관련 법령에
          따라, 아래의 목적과 범위 내에서 본인의 개인정보 및 초상(사진·영상
          등)이 수집·이용·제공되는 것에 동의합니다.
        </p>
        <p>
          <b>1. 개인정보 제공 및 활용</b>
          <br />
          제공 목적: 「{EVENT_SCHEDULE.title}」 행사 운영
          <br />
          제공 항목: 신청서에 기재된 내역 일체 (참가자 이름, 보호자 연락처,
          성별, 학년/연령)
          <br />
          보유·이용 기간: 행사 종료 후 즉시 파기
        </p>
        <p>
          <b>2. 초상권 활용</b>
          <br />
          활용 목적: 행사 홍보, 교육 및 기록 자료 공유
          <br />
          활용 매체: 행사 관련 공식 SNS 계정, 유튜브 채널, 홍보자료(온라인·오프라인
          포함)
          <br />
          활용 범위: 초상(사진·영상), 성명(필요 시), 인터뷰 내용
          <br />
          활용 기간: 행사 홍보 및 기록 자료로서 게시물 유지 기간 동안
          <br />
          기타 사항: 동의는 자발적으로 이루어졌으며, 게시 전까지는 철회 가능하나
          이미 게시·배포된 자료에 대해서는 철회가 불가함
        </p>
      </div>

      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(event) => setAgreed(event.target.checked)}
        />
        <span>개인정보 수집·이용 및 초상권 활용에 동의합니다. (필수)</span>
      </label>

      <button
        type="button"
        className="btn btn-primary"
        disabled={!agreed}
        onClick={() =>
          navigate('/booking/participant', {
            state: {
              boothId: booth.id,
              slotId: slot.id,
              accessCode:
                state.accessCode ||
                getGrantedBoothAccessCode(booth.id) ||
                undefined,
              // 초상권 동의가 필수라 체크 = 동의
              portraitConsent: true,
            },
          })
        }
      >
        다음
      </button>
    </section>
  );
}
