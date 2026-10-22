import { withGoogle, readStringField } from '../../../../../lib/google-route';

/**
 * POST /api/integrations/google/tasks/create
 * Creates a test task in the user's default task list (`@default`).
 *
 * Body: { title?, notes?, due? }
 */
export default withGoogle('POST', async ({ req, res, clients }) => {
  const title = readStringField(req.body, 'title', 200) ?? `UnifyOS test task ${new Date().toISOString()}`;
  const notes = readStringField(req.body, 'notes', 2000);
  const due = readStringField(req.body, 'due', 64);

  if (due && Number.isNaN(new Date(due).getTime())) {
    return res.status(400).json({ success: false, error: '`due` must be a valid RFC 3339 date.', code: 'INVALID_DUE' });
  }

  const response = await clients.tasks.tasks.insert({
    // `@default` is Google's alias for the user's primary task list.
    tasklist: '@default',
    requestBody: {
      title,
      ...(notes ? { notes } : {}),
      ...(due ? { due } : {}),
    },
  });

  return res.status(201).json({
    success: true,
    data: {
      id: response.data.id ?? null,
      title: response.data.title ?? title,
      status: response.data.status ?? null,
      due: response.data.due ?? null,
      taskList: '@default',
      updated: response.data.updated ?? null,
      selfLink: response.data.selfLink ?? null,
    },
  });
});
