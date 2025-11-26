import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method, query } = req;
  const appId = query.id as string;

  switch (method) {
    case 'POST':
      // Connect app
      // In production, this would initiate OAuth flow
      const authUrl = `https://oauth.example.com/${appId}/authorize`;
      return res.status(200).json({
        success: true,
        data: {
          appId,
          authUrl,
          connected: true,
          connectedAt: new Date().toISOString(),
        },
        message: `${appId} connected successfully`,
      });

    case 'DELETE':
      // Disconnect app
      return res.status(200).json({
        success: true,
        data: {
          appId,
          connected: false,
        },
        message: `${appId} disconnected successfully`,
      });

    default:
      res.setHeader('Allow', ['POST', 'DELETE']);
      return res.status(405).json({
        success: false,
        error: `Method ${method} Not Allowed`,
      });
  }
}
