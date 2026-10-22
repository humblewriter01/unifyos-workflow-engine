import { withGoogle, readQueryString } from '../../../../../lib/google-route';

/**
 * GET /api/integrations/google/contacts/list
 * Lists the 5 most recently modified contacts from the user's Google Contacts.
 *
 * Query: ?limit=5
 */
export default withGoogle('GET', async ({ req, res, clients }) => {
  const limit = Math.min(Math.max(Number(readQueryString(req, 'limit') ?? 5) || 5, 1), 100);

  const response = await clients.people.people.connections.list({
    resourceName: 'people/me',
    pageSize: limit,
    personFields: 'names,emailAddresses,phoneNumbers,photos,organizations',
    // Requires an empty syncToken, which is the default for this first page.
    sortOrder: 'LAST_MODIFIED_DESCENDING',
  });

  const contacts = (response.data.connections ?? []).map((person) => ({
    resourceName: person.resourceName ?? null,
    name: person.names?.[0]?.displayName ?? null,
    givenName: person.names?.[0]?.givenName ?? null,
    emails: (person.emailAddresses ?? []).map((email) => email.value).filter(Boolean),
    phones: (person.phoneNumbers ?? []).map((phone) => phone.value).filter(Boolean),
    photo: person.photos?.[0]?.url ?? null,
    organization: person.organizations?.[0]?.name ?? null,
  }));

  return res.status(200).json({
    success: true,
    data: {
      contacts,
      totalPeople: response.data.totalPeople ?? null,
    },
  });
});
