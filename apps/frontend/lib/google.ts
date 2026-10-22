import type { OAuth2Client } from 'googleapis-common';
import { drive, type drive_v3 } from '@googleapis/drive';
import { docs, type docs_v1 } from '@googleapis/docs';
import { sheets, type sheets_v4 } from '@googleapis/sheets';
import { slides, type slides_v1 } from '@googleapis/slides';
import { gmail, type gmail_v1 } from '@googleapis/gmail';
import { calendar, type calendar_v3 } from '@googleapis/calendar';
import { forms, type forms_v1 } from '@googleapis/forms';
import { tasks, type tasks_v1 } from '@googleapis/tasks';
import { people, type people_v1 } from '@googleapis/people';

import { getGoogleAuthClient } from './google-auth';

/**
 * Centralised Google API clients.
 *
 * Each API is imported from its own official `@googleapis/*` package rather
 * than the monolithic `googleapis` bundle (246 MB unpacked). On Vercel that
 * difference is the difference between a fast cold start and a function that
 * risks the bundle limit.
 */

export interface GoogleClients {
  /** Authenticated OAuth2 client, already refreshed when necessary. */
  auth: OAuth2Client;
  drive: drive_v3.Drive;
  docs: docs_v1.Docs;
  sheets: sheets_v4.Sheets;
  slides: slides_v1.Slides;
  gmail: gmail_v1.Gmail;
  calendar: calendar_v3.Calendar;
  forms: forms_v1.Forms;
  tasks: tasks_v1.Tasks;
  people: people_v1.People;
}

/** Builds every Google client for a user in one call (single token lookup). */
export async function getGoogleClients(userId: string): Promise<GoogleClients> {
  const auth = await getGoogleAuthClient(userId);

  return {
    auth,
    drive: drive({ version: 'v3', auth }),
    docs: docs({ version: 'v1', auth }),
    sheets: sheets({ version: 'v4', auth }),
    slides: slides({ version: 'v1', auth }),
    gmail: gmail({ version: 'v1', auth }),
    calendar: calendar({ version: 'v3', auth }),
    forms: forms({ version: 'v1', auth }),
    tasks: tasks({ version: 'v1', auth }),
    people: people({ version: 'v1', auth }),
  };
}

export async function getDriveClient(userId: string): Promise<drive_v3.Drive> {
  return (await getGoogleClients(userId)).drive;
}

export async function getDocsClient(userId: string): Promise<docs_v1.Docs> {
  return (await getGoogleClients(userId)).docs;
}

export async function getSheetsClient(userId: string): Promise<sheets_v4.Sheets> {
  return (await getGoogleClients(userId)).sheets;
}

export async function getSlidesClient(userId: string): Promise<slides_v1.Slides> {
  return (await getGoogleClients(userId)).slides;
}

export async function getGmailClient(userId: string): Promise<gmail_v1.Gmail> {
  return (await getGoogleClients(userId)).gmail;
}

export async function getCalendarClient(userId: string): Promise<calendar_v3.Calendar> {
  return (await getGoogleClients(userId)).calendar;
}

export async function getFormsClient(userId: string): Promise<forms_v1.Forms> {
  return (await getGoogleClients(userId)).forms;
}

export async function getTasksClient(userId: string): Promise<tasks_v1.Tasks> {
  return (await getGoogleClients(userId)).tasks;
}

export async function getPeopleClient(userId: string): Promise<people_v1.People> {
  return (await getGoogleClients(userId)).people;
}

/** MIME type Google Drive uses for native Docs, Sheets, Slides and Forms. */
export const GOOGLE_MIME_TYPES = {
  document: 'application/vnd.google-apps.document',
  spreadsheet: 'application/vnd.google-apps.spreadsheet',
  presentation: 'application/vnd.google-apps.presentation',
  form: 'application/vnd.google-apps.form',
  folder: 'application/vnd.google-apps.folder',
} as const;

/** Drive URLs for native Google files. Drive is the entry point for all IDs. */
export const GOOGLE_EDIT_URLS = {
  document: (id: string) => `https://docs.google.com/document/d/${id}/edit`,
  spreadsheet: (id: string) => `https://docs.google.com/spreadsheets/d/${id}/edit`,
  presentation: (id: string) => `https://docs.google.com/presentation/d/${id}/edit`,
  form: (id: string) => `https://docs.google.com/forms/d/${id}/edit`,
};

/**
 * Lists native Google Forms via Drive.
 *
 * The Forms API v1 has no `forms.list` method — it can only fetch a form by ID,
 * and the granted `forms.responses.readonly` scope cannot enumerate them. Drive
 * is the supported way to discover forms, which is why `drive` is a required
 * scope for the Forms integration.
 */
export async function listGoogleForms(userId: string, limit = 5) {
  const driveClient = await getDriveClient(userId);

  const response = await driveClient.files.list({
    q: `mimeType='${GOOGLE_MIME_TYPES.form}' and trashed=false`,
    orderBy: 'modifiedTime desc',
    pageSize: Math.min(Math.max(limit, 1), 20),
    fields: 'files(id,name,modifiedTime,createdTime,webViewLink,owners(displayName,emailAddress))',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  return (response.data.files ?? []).map((file) => ({
    id: file.id ?? null,
    name: file.name ?? null,
    modifiedTime: file.modifiedTime ?? null,
    createdTime: file.createdTime ?? null,
    webViewLink: file.webViewLink ?? (file.id ? GOOGLE_EDIT_URLS.form(file.id) : null),
    owner: file.owners?.[0]?.displayName ?? null,
  }));
}
