const zone = 'Asia/Seoul';
const time = new Intl.DateTimeFormat('ko-KR', { timeZone: zone, hour: 'numeric', minute: '2-digit', hour12: true });
const fullDate = new Intl.DateTimeFormat('ko-KR', { timeZone: zone, year: 'numeric', month: 'long', day: 'numeric' });

function validDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function kstDateKey(value?: string | null) {
  const date = validDate(value);
  return date ? new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10) : null;
}

export function formatAdminMessageTime(value?: string | null) {
  const date = validDate(value);
  return date ? time.format(date) : '시간 정보 없음';
}

export function formatAdminMessageDay(value?: string | null, now = Date.now()) {
  const date = validDate(value);
  if (!date) return '날짜 정보 없음';
  const key = kstDateKey(value);
  if (key === kstDateKey(new Date(now).toISOString())) return '오늘';
  if (key === kstDateKey(new Date(now - 86_400_000).toISOString())) return '어제';
  return fullDate.format(date);
}

export function formatAdminListTime(value?: string | null, now = Date.now()) {
  if (!validDate(value)) return '시간 정보 없음';
  const day = formatAdminMessageDay(value, now);
  return `${day} ${formatAdminMessageTime(value)}`;
}

export function formatReplyWait(value?: string | null, now = Date.now()) {
  const date = validDate(value);
  if (!date) return '대기 시간 정보 없음';
  const minutes = Math.floor((now - date.getTime()) / 60_000);
  if (minutes < 0) return '대기 시간 확인 중';
  if (minutes === 0) return '1분 미만 대기';
  if (minutes < 60) return `${minutes}분 대기`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 ${minutes % 60}분 대기`;
  return `${Math.floor(hours / 24)}일 ${hours % 24}시간 대기`;
}
