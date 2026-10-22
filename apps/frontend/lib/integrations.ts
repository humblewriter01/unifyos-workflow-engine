import { getEnv } from './env';

export type IntegrationId =
  | 'slack'
  | 'gmail'
  | 'calendar'
  | 'notion'
  | 'trello'
  | 'asana'
  | 'hubspot'
  | 'salesforce'
  | 'monday';

export interface IntegrationDefinition {
  id: IntegrationId;
  name: string;
  requiredEnv: string[];
}

export interface IntegrationStatus extends IntegrationDefinition {
  configured: boolean;
  missingEnv: string[];
}

export const INTEGRATIONS: IntegrationDefinition[] = [
  {
    id: 'slack',
    name: 'Slack',
    requiredEnv: ['SLACK_CLIENT_ID', 'SLACK_CLIENT_SECRET', 'ENCRYPTION_KEY'],
  },
  {
    id: 'gmail',
    name: 'Gmail',
    requiredEnv: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'ENCRYPTION_KEY'],
  },
  {
    id: 'calendar',
    name: 'Google Calendar',
    requiredEnv: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'ENCRYPTION_KEY'],
  },
  {
    id: 'notion',
    name: 'Notion',
    requiredEnv: ['NOTION_CLIENT_ID', 'NOTION_CLIENT_SECRET', 'ENCRYPTION_KEY'],
  },
  {
    id: 'trello',
    name: 'Trello',
    requiredEnv: ['TRELLO_API_KEY', 'TRELLO_API_SECRET'],
  },
  {
    id: 'asana',
    name: 'Asana',
    requiredEnv: ['ASANA_CLIENT_ID', 'ASANA_CLIENT_SECRET', 'ENCRYPTION_KEY'],
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    requiredEnv: ['HUBSPOT_CLIENT_ID', 'HUBSPOT_CLIENT_SECRET', 'ENCRYPTION_KEY'],
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    requiredEnv: ['SALESFORCE_CLIENT_ID', 'SALESFORCE_CLIENT_SECRET', 'ENCRYPTION_KEY'],
  },
  {
    id: 'monday',
    name: 'Monday.com',
    requiredEnv: ['MONDAY_CLIENT_ID', 'MONDAY_CLIENT_SECRET', 'ENCRYPTION_KEY'],
  },
];

const hasValue = (key: string) => Boolean(getEnv(key));

export function getIntegrationStatus(id: string): IntegrationStatus | undefined {
  const definition = INTEGRATIONS.find((integration) => integration.id === id);
  if (!definition) return undefined;

  const missingEnv = definition.requiredEnv.filter((key) => !hasValue(key));
  return {
    ...definition,
    configured: missingEnv.length === 0,
    missingEnv,
  };
}

export function getAllIntegrationStatuses(): IntegrationStatus[] {
  return INTEGRATIONS.map((integration) => getIntegrationStatus(integration.id)!);
}

/**
 * Re-exported from `lib/app-url` so integration callbacks and NextAuth share
 * exactly one definition of the application's public origin. Pass the current
 * request to prefer the origin the callback actually arrived on.
 */
export { getAppBaseUrl, getOAuthCallbackUrl } from './app-url';
