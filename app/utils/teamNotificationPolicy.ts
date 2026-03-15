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
  return eventType === 'team_chat' || eventType === 'team_memo' || eventType === 'team_memo_comment';
}

export function isImmediateTeamEmail(eventType?: TeamEventType | null) {
  return eventType === 'team_memo' || eventType === 'team_memo_comment';
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

  if (isImmediateTeamEmail(params.eventType) && actorEmail) {
    recipients.push(actorEmail);
  }

  return Array.from(new Set(recipients)).filter((email) => {
    if (!actorEmail) return true;
    if (isImmediateTeamEmail(params.eventType)) return true;
    return email !== actorEmail;
  });
}
