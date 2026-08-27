import type { NextApiRequest, NextApiResponse } from 'next';
import { INTEGRATIONS } from '../../../lib/integrations';
import { supabase } from '../../../lib/supabase';

function emptyAnalytics() {
  return {
    connectedApps: 0,
    totalApps: INTEGRATIONS.length,
    activeWorkflows: 0,
    totalWorkflows: 0,
    timeSaved: 0,
    notificationsProcessed: 0,
    workflowExecutions: 0,
    lastSync: new Date().toISOString(),
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, error: `Method ${req.method} Not Allowed` });
  }

  if (!supabase) {
    return res.status(200).json({
      success: true,
      data: emptyAnalytics(),
      meta: { degraded: true, reason: 'Supabase is not configured' },
    });
  }

  try {
    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user?.id;

    if (!userId) {
      return res.status(200).json({ success: true, data: emptyAnalytics() });
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [connectedAppsResult, workflowsResult, executionsResult, notificationsResult] = await Promise.all([
      supabase.from('app_tokens').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('connected', true),
      supabase.from('workflows').select('enabled, execution_count').eq('user_id', userId),
      supabase.from('workflow_executions').select('*', { count: 'exact', head: true }).gte('started_at', sevenDaysAgo),
      supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', sevenDaysAgo),
    ]);

    const queryError = [connectedAppsResult.error, workflowsResult.error, executionsResult.error, notificationsResult.error]
      .find(Boolean);
    if (queryError) {
      console.warn('[Analytics] Database tables are unavailable; returning empty metrics:', queryError.message);
      return res.status(200).json({
        success: true,
        data: emptyAnalytics(),
        meta: { degraded: true, reason: 'Analytics tables are unavailable' },
      });
    }

    const workflows = workflowsResult.data || [];
    const totalExecutions = workflows.reduce(
      (sum, workflow) => sum + (workflow.execution_count || 0),
      0,
    );

    return res.status(200).json({
      success: true,
      data: {
        connectedApps: connectedAppsResult.count || 0,
        totalApps: INTEGRATIONS.length,
        activeWorkflows: workflows.filter((workflow) => workflow.enabled).length,
        totalWorkflows: workflows.length,
        timeSaved: Math.round((totalExecutions * 2 / 60) * 10) / 10,
        notificationsProcessed: notificationsResult.count || 0,
        workflowExecutions: executionsResult.count || 0,
        lastSync: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Failed to fetch analytics:', error);
    return res.status(200).json({
      success: true,
      data: emptyAnalytics(),
      meta: { degraded: true, reason: 'Analytics is temporarily unavailable' },
    });
  }
}
