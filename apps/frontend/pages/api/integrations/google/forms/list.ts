import { withGoogle, readQueryString } from '../../../../../lib/google-route';
import { listGoogleForms } from '../../../../../lib/google';

/**
 * GET /api/integrations/google/forms/list
 * Lists the 5 most recently modified Google Forms.
 *
 * The Forms API v1 exposes no list endpoint, and `forms.responses.readonly`
 * cannot enumerate forms — so this resolves through Drive, which is why the
 * Drive scope is part of the Forms integration.
 *
 * Query: ?limit=5
 */
export default withGoogle('GET', async ({ req, res, userId }) => {
  const limit = Math.min(Math.max(Number(readQueryString(req, 'limit') ?? 5) || 5, 1), 20);
  const forms = await listGoogleForms(userId, limit);

  return res.status(200).json({
    success: true,
    data: {
      forms,
      source: 'drive',
      note: 'Listing uses the Drive API because Google Forms API v1 has no list method.',
    },
  });
});
