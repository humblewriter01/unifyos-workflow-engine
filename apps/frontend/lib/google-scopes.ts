/**
 * Google OAuth scopes used by UnifyOS.
 *
 * This module is intentionally free of server-only imports so it can be shared
 * between the NextAuth route, the integration routes, and the settings UI.
 */

export const GOOGLE_SCOPES = {
  drive: 'https://www.googleapis.com/auth/drive',
  documents: 'https://www.googleapis.com/auth/documents',
  spreadsheets: 'https://www.googleapis.com/auth/spreadsheets',
  presentations: 'https://www.googleapis.com/auth/presentations',
  gmailModify: 'https://www.googleapis.com/auth/gmail.modify',
  calendar: 'https://www.googleapis.com/auth/calendar',
  // Narrow by design: the Forms API only exposes responses under this scope.
  // Listing forms requires the Drive scope (see `lib/google.ts#listForms`).
  formsResponsesReadonly: 'https://www.googleapis.com/auth/forms.responses.readonly',
  tasks: 'https://www.googleapis.com/auth/tasks',
  contacts: 'https://www.googleapis.com/auth/contacts',
} as const;

/** Identity scopes — always requested so we can map the Google account. */
export const GOOGLE_IDENTITY_SCOPES = ['openid', 'email', 'profile'] as const;

/** Workspace scopes required by the Drive/Docs/Sheets/Slides/Gmail/etc. suite. */
export const GOOGLE_INTEGRATION_SCOPES = [
  GOOGLE_SCOPES.drive,
  GOOGLE_SCOPES.documents,
  GOOGLE_SCOPES.spreadsheets,
  GOOGLE_SCOPES.presentations,
  GOOGLE_SCOPES.gmailModify,
  GOOGLE_SCOPES.calendar,
  GOOGLE_SCOPES.formsResponsesReadonly,
  GOOGLE_SCOPES.tasks,
  GOOGLE_SCOPES.contacts,
] as const;

/** Everything requested during the integration "Connect" flow. */
export const GOOGLE_FULL_SCOPES = [...GOOGLE_IDENTITY_SCOPES, ...GOOGLE_INTEGRATION_SCOPES];

/**
 * Google returns granted scopes on the token, which can differ from the scopes
 * requested when the user unticked a permission. These are the scopes each
 * feature needs, so the UI can explain precisely what is missing.
 */
export const GOOGLE_SERVICE_SCOPES: Record<string, string> = {
  drive: GOOGLE_SCOPES.drive,
  docs: GOOGLE_SCOPES.documents,
  sheets: GOOGLE_SCOPES.spreadsheets,
  slides: GOOGLE_SCOPES.presentations,
  gmail: GOOGLE_SCOPES.gmailModify,
  calendar: GOOGLE_SCOPES.calendar,
  forms: GOOGLE_SCOPES.formsResponsesReadonly,
  tasks: GOOGLE_SCOPES.tasks,
  contacts: GOOGLE_SCOPES.contacts,
};

/** Google Meet is created through Calendar's `conferenceData`, so no Meet scope exists. */
export const GOOGLE_MEET_CONFERENCE_TYPE = 'hangoutsMeet';
