import type { NextApiRequest, NextApiResponse } from 'next';

// This would be shared in a real app - for demo, duplicate storage reference
// In production, use a database or shared state management
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method, query } = req;
  const id = parseInt(query.id as string);

  if (method !== 'PATCH') {
    res.setHeader('Allow', ['PATCH']);
    return res.status(405).json({
      success: false,
      error: `Method ${method} Not Allowed`,
    });
  }

  // In a real app, update database here
  // For now, return success (client-side state handles the update)
  return res.status(200).json({
    success: true,
    data: { id, unread: false },
    message: 'Notification marked as read',
  });
}
