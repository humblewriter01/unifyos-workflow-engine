import { withGoogle, readStringField } from '../../../../../lib/google-route';
import { GOOGLE_EDIT_URLS } from '../../../../../lib/google';

/**
 * POST /api/integrations/google/slides/create
 * Creates a blank Google Slides presentation and returns its ID and edit URL.
 *
 * Body: { title? }
 */
export default withGoogle('POST', async ({ req, res, clients }) => {
  const title = readStringField(req.body, 'title', 200) ?? `UnifyOS presentation ${new Date().toISOString()}`;

  const response = await clients.slides.presentations.create({
    requestBody: { title },
  });

  const presentationId = response.data.presentationId;

  if (!presentationId) {
    return res.status(502).json({
      success: false,
      error: 'Google did not return a presentation ID.',
      code: 'GOOGLE_API_ERROR',
    });
  }

  return res.status(201).json({
    success: true,
    data: {
      presentationId,
      title: response.data.title ?? title,
      slideCount: response.data.slides?.length ?? 0,
      revisionId: response.data.revisionId ?? null,
      url: GOOGLE_EDIT_URLS.presentation(presentationId),
    },
  });
});
