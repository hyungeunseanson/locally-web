import { expect, test } from '@playwright/test';

import { buildTeamEmailRecipients } from '../../app/utils/teamNotificationPolicy';

test.describe('Team notify recipient policy', () => {
  test('includes the author for team memo emails', async () => {
    const recipients = buildTeamEmailRecipients({
      eventType: 'team_memo',
      whitelistEmails: ['teammate@example.com'],
      actorEmail: 'author@example.com',
    });

    expect(recipients).toEqual(['teammate@example.com', 'author@example.com']);
  });

  test('still excludes the author for team chat emails', async () => {
    const recipients = buildTeamEmailRecipients({
      eventType: 'team_chat',
      whitelistEmails: ['teammate@example.com', 'author@example.com'],
      actorEmail: 'author@example.com',
    });

    expect(recipients).toEqual(['teammate@example.com']);
  });
});
