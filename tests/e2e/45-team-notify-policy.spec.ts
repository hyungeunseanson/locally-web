import { expect, test } from '@playwright/test';

import {
  buildTeamEmailRecipients,
  isImmediateTeamEmail,
  shouldSendTeamEmail,
} from '../../app/utils/teamNotificationPolicy';

test.describe('Team notify recipient policy', () => {
  test('excludes the author for team memo emails', async () => {
    const recipients = buildTeamEmailRecipients({
      eventType: 'team_memo',
      whitelistEmails: ['teammate@example.com', 'author@example.com'],
      actorEmail: 'author@example.com',
    });

    expect(recipients).toEqual(['teammate@example.com']);
  });

  test('sends team todo emails immediately while excluding the author', async () => {
    const recipients = buildTeamEmailRecipients({
      eventType: 'team_todo',
      whitelistEmails: ['teammate@example.com', 'author@example.com'],
      actorEmail: 'author@example.com',
    });

    expect(shouldSendTeamEmail('team_todo')).toBe(true);
    expect(isImmediateTeamEmail('team_todo')).toBe(true);
    expect(recipients).toEqual(['teammate@example.com']);
  });

  test('still excludes the author for team chat emails', async () => {
    const recipients = buildTeamEmailRecipients({
      eventType: 'team_chat',
      whitelistEmails: ['teammate@example.com', 'author@example.com'],
      actorEmail: 'author@example.com',
    });

    expect(recipients).toEqual(['teammate@example.com']);
  });

  test('keeps team task comments as in-app only', async () => {
    expect(shouldSendTeamEmail('team_task_comment')).toBe(false);
    expect(isImmediateTeamEmail('team_task_comment')).toBe(false);
  });
});
