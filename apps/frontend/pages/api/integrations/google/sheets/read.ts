import { withGoogle, readStringField } from '../../../../../lib/google-route';

/**
 * POST /api/integrations/google/sheets/read
 *
 * Reads a range from a spreadsheet. `spreadsheetId` is the Drive file ID —
 * use GET /api/integrations/google/drive/list?type=sheet to find one.
 *
 * Body: { spreadsheetId, range? }   (range defaults to the first sheet's A1:E20)
 */
export default withGoogle('POST', async ({ req, res, clients }) => {
  const spreadsheetId = readStringField(req.body, 'spreadsheetId', 200);
  const range = readStringField(req.body, 'range', 300);

  if (!spreadsheetId) {
    return res.status(400).json({
      success: false,
      error: '`spreadsheetId` is required. Find one with GET /api/integrations/google/drive/list?type=sheet.',
      code: 'MISSING_SPREADSHEET_ID',
    });
  }

  // Without a range, read the first tab so the call still returns useful data.
  let resolvedRange = range;
  if (!resolvedRange) {
    const meta = await clients.sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets(properties(title,sheetId,index))',
    });
    const firstSheet = meta.data.sheets?.[0]?.properties?.title;
    if (!firstSheet) {
      return res.status(404).json({
        success: false,
        error: 'That spreadsheet has no readable sheets.',
        code: 'SPREADSHEET_EMPTY',
      });
    }
    resolvedRange = `'${firstSheet.replace(/'/g, "''")}'!A1:E20`;
  }

  const response = await clients.sheets.spreadsheets.values.get({
    spreadsheetId,
    range: resolvedRange,
    majorDimension: 'ROWS',
  });

  return res.status(200).json({
    success: true,
    data: {
      spreadsheetId,
      range: response.data.range ?? resolvedRange,
      majorDimension: response.data.majorDimension ?? 'ROWS',
      rowCount: response.data.values?.length ?? 0,
      values: response.data.values ?? [],
    },
  });
});
