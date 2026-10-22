import { withGoogle, readStringField } from '../../../../../lib/google-route';
import { GOOGLE_EDIT_URLS } from '../../../../../lib/google';

/**
 * POST /api/integrations/google/docs/create
 * Creates a blank Google Doc and returns its ID and edit URL.
 *
 * Body: { title? }
 */
export default withGoogle('POST', async ({ req, res, clients }) => {
  const title = readStringField(req.body, 'title', 200) ?? `UnifyOS document ${new Date().toISOString()}`;

  const response = await clients.docs.documents.create({
    requestBody: { title },
  });

  const documentId = response.data.documentId;

  if (!documentId) {
    return res.status(502).json({
      success: false,
      error: 'Google did not return a document ID.',
      code: 'GOOGLE_API_ERROR',
    });
  }

  return res.status(201).json({
    success: true,
    data: {
      documentId,
      title: response.data.title ?? title,
      revisionId: response.data.revisionId ?? null,
      url: GOOGLE_EDIT_URLS.document(documentId),
    },
  });
});
