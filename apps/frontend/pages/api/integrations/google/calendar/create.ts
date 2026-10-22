import { randomUUID } from 'crypto';
import { withGoogle, readStringField, readNumberField } from '../../../../../lib/google-route';
import { GOOGLE_MEET_CONFERENCE_TYPE } from '../../../../../lib/google-scopes';

const DEFAULT_DURATION_MINUTES = 30;

/**
 * POST /api/integrations/google/calendar/create
 *
 * Creates an event on the primary calendar and attaches a Google Meet link.
 * Meet is provisioned by Calendar's `conferenceData`, which requires
 * `conferenceDataVersion: 1` on the insert call — there is no separate Meet
 * scope or API involved.
 *
 * Body: { summary?, description?, start?, durationMinutes?, timeZone?, attendeeEmail? }
 */
export default withGoogle('POST', async ({ req, res, clients }) => {
  const body = req.body;
  const summary = readStringField(body, 'summary', 200) ?? 'UnifyOS test event';
  const description =
    readStringField(body, 'description', 1000) ?? 'Created by UnifyOS to verify the Google Calendar + Meet integration.';
  const timeZone = readStringField(body, 'timeZone', 64) ?? 'UTC';
  const attendeeEmail = readStringField(body, 'attendeeEmail', 320);
  const durationMinutes = Math.min(Math.max(readNumberField(body, 'durationMinutes') ?? DEFAULT_DURATION_MINUTES, 5), 480);

  // Default to one hour from now; reject an unparseable start rather than
  // silently scheduling something the caller did not ask for.
  const startRaw = readStringField(body, 'start', 64);
  const start = startRaw ? new Date(startRaw) : new Date(Date.now() + 60 * 60 * 1000);
  if (Number.isNaN(start.getTime())) {
    return res.status(400).json({ success: false, error: '`start` must be a valid ISO 8601 date-time.', code: 'INVALID_START' });
  }

  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

  const response = await clients.calendar.events.insert({
    calendarId: 'primary',
    // Required for Meet creation; without it Google drops `conferenceData`.
    conferenceDataVersion: 1,
    sendUpdates: attendeeEmail ? 'all' : 'none',
    requestBody: {
      summary,
      description,
      start: { dateTime: start.toISOString(), timeZone },
      end: { dateTime: end.toISOString(), timeZone },
      ...(attendeeEmail ? { attendees: [{ email: attendeeEmail }] } : {}),
      conferenceData: {
        createRequest: {
          // A unique id makes the request idempotent if it is retried.
          requestId: `unifyos-${randomUUID()}`,
          conferenceSolutionKey: { type: GOOGLE_MEET_CONFERENCE_TYPE },
        },
      },
    },
  });

  const created = response.data;

  return res.status(201).json({
    success: true,
    data: {
      id: created.id ?? null,
      summary: created.summary ?? null,
      htmlLink: created.htmlLink ?? null,
      meetLink: created.hangoutLink ?? created.conferenceData?.entryPoints?.[0]?.uri ?? null,
      start: created.start?.dateTime ?? null,
      end: created.end?.dateTime ?? null,
      conferenceStatus: created.conferenceData?.createRequest?.status?.statusCode ?? null,
      timeZone,
    },
    message:
      created.hangoutLink
        ? 'Event created with a Google Meet link.'
        : 'Event created. Google may still be provisioning the Meet link — re-read the event shortly.',
  });
});
