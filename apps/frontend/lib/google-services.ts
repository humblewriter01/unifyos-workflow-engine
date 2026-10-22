/**
 * Client-safe metadata describing each Google service UnifyOS integrates with.
 *
 * Deliberately contains **no** imports: the settings page renders this in the
 * browser, and importing `lib/google.ts` there would pull the whole Google SDK
 * into the client bundle.
 */

export type GoogleServiceId =
  | 'drive'
  | 'docs'
  | 'sheets'
  | 'slides'
  | 'gmail'
  | 'calendar'
  | 'forms'
  | 'tasks'
  | 'contacts';

export interface GoogleServiceDefinition {
  id: GoogleServiceId;
  name: string;
  description: string;
  /** Route used by the "Test" button. */
  testPath: string;
  method: 'GET' | 'POST';
  /** Scope the service needs; used to explain permission errors in the UI. */
  scope: string;
  /** What the test call does, shown as helper text. */
  testLabel: string;
}

export const GOOGLE_SERVICES: GoogleServiceDefinition[] = [
  {
    id: 'drive',
    name: 'Google Drive',
    description: 'Browse files and resolve the file IDs used by Docs, Sheets and Slides.',
    testPath: '/api/integrations/google/drive/list',
    method: 'GET',
    scope: 'https://www.googleapis.com/auth/drive',
    testLabel: 'Lists 5 recently modified files',
  },
  {
    id: 'docs',
    name: 'Google Docs',
    description: 'Create and address documents inside Drive.',
    testPath: '/api/integrations/google/docs/create',
    method: 'POST',
    scope: 'https://www.googleapis.com/auth/documents',
    testLabel: 'Creates a blank document',
  },
  {
    id: 'sheets',
    name: 'Google Sheets',
    description: 'Read and write spreadsheet ranges.',
    testPath: '/api/integrations/google/sheets/read',
    method: 'POST',
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    testLabel: 'Reads A1:C5 from a spreadsheet you pass',
  },
  {
    id: 'slides',
    name: 'Google Slides',
    description: 'Create and address presentations inside Drive.',
    testPath: '/api/integrations/google/slides/create',
    method: 'POST',
    scope: 'https://www.googleapis.com/auth/presentations',
    testLabel: 'Creates a blank presentation',
  },
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Read unread mail, send messages and manage threads.',
    testPath: '/api/integrations/google/gmail/list',
    method: 'GET',
    scope: 'https://www.googleapis.com/auth/gmail.modify',
    testLabel: 'Lists 5 recent unread emails',
  },
  {
    id: 'calendar',
    name: 'Google Calendar',
    description: 'Read upcoming events and create events with Google Meet links.',
    testPath: '/api/integrations/google/calendar/list',
    method: 'GET',
    scope: 'https://www.googleapis.com/auth/calendar',
    testLabel: 'Lists 5 upcoming events',
  },
  {
    id: 'forms',
    name: 'Google Forms',
    description: 'Read form responses; forms themselves are listed through Drive.',
    testPath: '/api/integrations/google/forms/list',
    method: 'GET',
    scope: 'https://www.googleapis.com/auth/forms.responses.readonly',
    testLabel: 'Lists 5 recently modified forms',
  },
  {
    id: 'tasks',
    name: 'Google Tasks',
    description: 'Create and complete tasks in the default task list.',
    testPath: '/api/integrations/google/tasks/create',
    method: 'POST',
    scope: 'https://www.googleapis.com/auth/tasks',
    testLabel: 'Creates a test task',
  },
  {
    id: 'contacts',
    name: 'Google Contacts',
    description: 'Read the user’s contacts for people lookups.',
    testPath: '/api/integrations/google/contacts/list',
    method: 'GET',
    scope: 'https://www.googleapis.com/auth/contacts',
    testLabel: 'Lists 5 most recently modified contacts',
  },
];

export const GOOGLE_SERVICE_IDS = GOOGLE_SERVICES.map((service) => service.id);
