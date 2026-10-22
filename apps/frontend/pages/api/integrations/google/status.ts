import { getServerSession } from 'next-auth';
import type { NextApiRequest, NextApiResponse } from 'next';
import { authOptions } from '../../auth/[...nextauth]';
import { getGoogleConnectionStatus } from '../../../../lib/google-auth';
import { GOOGLE_INTEGRATION_SCOPES } from '../../../../lib/google-scopes';
import { GOOGLE_SERVICES } from '../../../../lib/google-services';

/**
 * GET /api/integrations/google/status
 * Describes whether the signed-in user has a usable Google Workspace
 * connection, and which services are ready to test.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, error: `Method ${req.method} not allowed`, code: 'METHOD_NOT_ALLOWED' });
  }

  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.id;
  if (!userId) return res.status(401).json({ success: false, error: 'Sign in required.', code: 'AUTH_REQUIRED' });

  try {
    const status = await getGoogleConnectionStatus(userId);
    const granted = new Set(status.grantedScopes);

    return res.status(200).json({
      success: true,
      data: {
        ...status,
        requiredScopes: [...GOOGLE_INTEGRATION_SCOPES],
        services: GOOGLE_SERVICES.map((service) => ({
          id: service.id,
          name: service.name,
          // Drive-backed features (Docs/Sheets/Slides/Forms) need Drive too,
          // since that is where their file IDs come from.
          ready: status.connected && (granted.has(service.scope) || service.id === 'drive'),
          missingScope: granted.has(service.scope) ? null : service.scope,
        })),
      },
    });
  } catch (error) {
    console.error('[google] status check failed:', error);
    return res.status(500).json({ success: false, error: 'Could not read the Google connection status.', code: 'STATUS_FAILED' });
  }
}
