import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;

  if (method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({
      success: false,
      error: `Method ${method} Not Allowed`,
    });
  }

  // Return dashboard statistics
  return res.status(200).json({
    success: true,
    data: {
      connectedApps: 3,
      totalApps: 8,
      activeWorkflows: 2,
      totalWorkflows: 2,
      timeSaved: 4.5, // hours this week
      notificationsProcessed: 127,
      workflowExecutions: 70,
      lastSync: new Date().toISOString(),
    },
  });
}
