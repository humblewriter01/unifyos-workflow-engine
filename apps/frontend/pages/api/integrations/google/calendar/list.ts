import { withGoogle, readQueryString } from '../../../../../lib/google-route';

/**
 * GET /api/integrations/google/calendar/list
 * Lists the 5 next upcoming events on the user's primary calendar.
 */
export default withGoogle('GET', async ({ req, res, clients }) => {
  const limit = Math.min(Math.max(Number(readQueryString(req, 'limit') ?? 5) || 5, 1), 25);
  const calendarId = readQueryString(req, 'calendarId') ?? 'primary';

  const response = await clients.calendar.events.list({
    calendarId,
    timeMin: new Date().toISOString(),
    maxResults: limit,
    singleEvents: true,
    orderBy: 'startTime',
  });

  const events = (response.data.items ?? []).map((event) => ({
    id: event.id ?? null,
    summary: event.summary ?? null,
    description: event.description ?? null,
    status: event.status ?? null,
    start: event.start?.dateTime ?? event.start?.date ?? null,
    end: event.end?.dateTime ?? event.end?.date ?? null,
    htmlLink: event.htmlLink ?? null,
    meetLink: event.hangoutLink ?? null,
    organizer: event.organizer?.email ?? null,
    attendees: (event.attendees ?? []).map((attendee) => attendee.email).filter(Boolean),
  }));

  return res.status(200).json({
    success: true,
    data: { calendarId, timeZone: response.data.timeZone ?? null, events },
  });
});
