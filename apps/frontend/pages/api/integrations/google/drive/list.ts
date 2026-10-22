import { withGoogle, readQueryString } from '../../../../../lib/google-route';
import { GOOGLE_MIME_TYPES } from '../../../../../lib/google';

/** Maps the `type` query parameter onto Drive MIME types. */
const MIME_BY_TYPE: Record<string, string> = {
  document: GOOGLE_MIME_TYPES.document,
  doc: GOOGLE_MIME_TYPES.document,
  spreadsheet: GOOGLE_MIME_TYPES.spreadsheet,
  sheet: GOOGLE_MIME_TYPES.spreadsheet,
  presentation: GOOGLE_MIME_TYPES.presentation,
  slide: GOOGLE_MIME_TYPES.presentation,
  form: GOOGLE_MIME_TYPES.form,
  folder: GOOGLE_MIME_TYPES.folder,
};

/**
 * GET /api/integrations/google/drive/list
 *
 * Lists the 5 most recently modified files. This is the entry point for the
 * Docs/Sheets/Slides integrations: Drive owns the file IDs those APIs need.
 *
 * Query: ?limit=5&type=document|sheet|slide|form|folder&q=name contains 'x'
 */
export default withGoogle('GET', async ({ req, res, clients }) => {
  const limit = Math.min(Math.max(Number(readQueryString(req, 'limit') ?? 5) || 5, 1), 50);
  const type = readQueryString(req, 'type')?.toLowerCase();
  const search = readQueryString(req, 'q', 200);

  const mimeType = type ? MIME_BY_TYPE[type] : undefined;
  if (type && !mimeType) {
    return res.status(400).json({
      success: false,
      error: `Unknown file type "${type}". Use one of: ${Object.keys(MIME_BY_TYPE).join(', ')}.`,
      code: 'INVALID_FILE_TYPE',
    });
  }

  // Drive query strings use single quotes as delimiters, so escape any that the
  // caller supplied instead of interpolating raw input.
  const escapedSearch = search?.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const conditions = ['trashed=false', mimeType ? `mimeType='${mimeType}'` : null, escapedSearch ? `name contains '${escapedSearch}'` : null]
    .filter((condition): condition is string => Boolean(condition));

  const response = await clients.drive.files.list({
    q: conditions.join(' and '),
    orderBy: 'modifiedTime desc',
    pageSize: limit,
    fields: 'files(id,name,mimeType,modifiedTime,createdTime,webViewLink,iconLink,size,owners(displayName,emailAddress)),nextPageToken',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const files = (response.data.files ?? []).map((file) => ({
    id: file.id ?? null,
    name: file.name ?? null,
    mimeType: file.mimeType ?? null,
    modifiedTime: file.modifiedTime ?? null,
    createdTime: file.createdTime ?? null,
    webViewLink: file.webViewLink ?? null,
    owner: file.owners?.[0]?.displayName ?? null,
    ownerEmail: file.owners?.[0]?.emailAddress ?? null,
    size: file.size ?? null,
  }));

  return res.status(200).json({
    success: true,
    data: { files, nextPageToken: response.data.nextPageToken ?? null, query: conditions.join(' and ') },
  });
});
