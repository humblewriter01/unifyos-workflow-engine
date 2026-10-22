import { withGoogle, readQueryString } from '../../../../../lib/google-route';

/**
 * GET /api/integrations/google/gmail/list
 * Lists the 5 most recent unread emails in the connected Gmail mailbox.
 */
export default withGoogle('GET', async ({ req, res, clients }) => {
  const limit = Math.min(Math.max(Number(readQueryString(req, 'limit') ?? 5) || 5, 1), 25);

  const listed = await clients.gmail.users.messages.list({
    userId: 'me',
    q: 'is:unread',
    maxResults: limit,
  });

  const ids = (listed.data.messages ?? [])
    .map((message) => message.id)
    .filter((id): id is string => Boolean(id));

  // `messages.list` only returns IDs, so fetch lightweight headers for each.
  const messages = await Promise.all(
    ids.map(async (id) => {
      const detail = await clients.gmail.users.messages.get({
        userId: 'me',
        id,
        format: 'metadata',
        metadataHeaders: ['Subject', 'From', 'Date'],
      });

      const headers = detail.data.payload?.headers ?? [];
      const header = (name: string) =>
        headers.find((entry) => entry.name?.toLowerCase() === name.toLowerCase())?.value ?? null;

      return {
        id,
        threadId: detail.data.threadId ?? null,
        subject: header('Subject'),
        from: header('From'),
        date: header('Date'),
        snippet: detail.data.snippet ?? null,
        labels: detail.data.labelIds ?? [],
      };
    }),
  );

  return res.status(200).json({
    success: true,
    data: {
      unreadEstimate: listed.data.resultSizeEstimate ?? null,
      messages,
    },
  });
});
