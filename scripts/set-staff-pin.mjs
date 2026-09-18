/**
 * 운영자 한 명의 로그인 비밀번호(PIN)를 바꾼다.
 *
 * 사용:
 *   node scripts/set-staff-pin.mjs <로그인ID> <새 PIN>
 *   예) node scripts/set-staff-pin.mjs 황보예린 1234
 *
 * - PIN 은 명령줄로만 받고 어디에도 저장하지 않는다 (저장소·로그에 남기지 말 것).
 * - 앱과 같은 규칙으로 6자리 미만이면 뒤에 0을 붙여 Firebase Auth 비밀번호로 만든다.
 *   로그인 화면에서는 입력한 PIN 그대로 (예: 1234) 넣으면 된다.
 */
import { getAccessToken, getDocument, setAuthPassword } from './lib/firebaseAdminRest.mjs';

const [loginId, pin] = process.argv.slice(2);
if (!loginId || !pin || !/^\d{4,12}$/.test(pin)) {
  console.error('사용법: node scripts/set-staff-pin.mjs <로그인ID> <새 PIN(숫자 4~12자리)>');
  process.exit(1);
}

function pinToAuthPassword(value) {
  const trimmed = String(value).trim();
  return trimmed.length >= 6 ? trimmed : trimmed.padEnd(6, '0');
}

const token = await getAccessToken();
const index = await getDocument(token, `staffLoginIndex/${loginId}`);
if (!index?.uid) {
  console.error(`'${loginId}' 는 등록된 로그인 ID 가 아닙니다.`);
  process.exit(1);
}
await setAuthPassword(token, String(index.uid), pinToAuthPassword(pin));
console.log(`'${loginId}' 의 비밀번호를 바꿨습니다. 이전 비밀번호는 더 이상 동작하지 않습니다.`);
