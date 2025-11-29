import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../lib/supabase';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { method } = req;

  if (method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({
      success: false,
      error: `Method ${method} Not Allowed`,
    });
  }

  try {
    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user?.id;

    if (!userId) {
      return res.status(200).json({
        success: true,
        data: {
          connectedApps: 0,
          totalApps: 8,
          activeWorkflows: 0,
          totalWorkflows: 0,
          timeSaved: 0,
          notificationsProcessed: 0,
          workflowExecutions: 0,
          lastSync: new Date().toISOString(),
        },
      });
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [
      { count: connectedAppsData },
      { data: workflows },
      { count: recentExecutions },
      { count: notifications },
    ] = await Promise.all([
      supabase.from('app_tokens').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('connected', true),
      supabase.from('workflows').select('enabled, execution_count').eq('user_id', userId),
      supabase.from('workflow_executions').select('*', { count: 'exact', head: true }).gte('started_at', sevenDaysAgo),
      supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', sevenDaysAgo),
    ]);

    const activeWorkflows = (workflows || []).filter((w: any) => w.enabled).length;
    const totalExecutions = (workflows || []).reduce((sum: number, w: any) => sum + (w.execution_count || 0), 0);

    // Calculate time saved (rough estimate: 2 minutes per execution)
    const timeSavedMinutes = totalExecutions * 2;
    const timeSavedHours = Math.round((timeSavedMinutes / 60) * 10) / 10;

    return res.status(200).json({
      success: true,
      data: {
        connectedApps: connectedAppsData || 0,
        totalApps: 8,
        activeWorkflows,
        totalWorkflows: workflows?.length || 0,
        timeSaved: timeSavedHours,
        notificationsProcessed: notifications || 0,
        workflowExecutions: recentExecutions || 0,
        lastSync: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Failed to fetch analytics:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}
