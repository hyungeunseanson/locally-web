export type TeamEventType =
  | 'team_chat'
  | 'team_todo'
  | 'team_task_comment'
  | 'team_memo'
  | 'team_memo_comment';

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function shouldSendTeamEmail(eventType?: TeamEventType | null) {
  return eventType === 'team_chat' || eventType === 'team_todo' || eventType === 'team_memo' || eventType === 'team_memo_comment';
}

export function isImmediateTeamEmail(eventType?: TeamEventType | null) {
  return eventType === 'team_todo' || eventType === 'team_memo' || eventType === 'team_memo_comment';
}

export function buildTeamEmailRecipients(params: {
  eventType?: TeamEventType | null;
  whitelistEmails: string[];
  actorEmail?: string | null;
}) {
  const actorEmail = typeof params.actorEmail === 'string' ? normalizeEmail(params.actorEmail) : '';
  const recipients = params.whitelistEmails
    .map((email) => (typeof email === 'string' ? normalizeEmail(email) : ''))
    .filter(Boolean);

  return Array.from(new Set(recipients)).filter((email) => {
    // [Fix] actorEmail 미확인 시 fail-closed — 발신자 이메일 모를 때 모두에게 발송하면 작성자 본인도 수신
    if (!actorEmail) return false;
    return email !== actorEmail;
  });
}
