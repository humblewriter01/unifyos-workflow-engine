import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { supabase } from '../../../lib/supabase';

const emptyMeta = { total: 0, active: 0, totalExecutions: 0 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!['GET', 'POST'].includes(req.method || '')) {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ success: false, error: `Method ${req.method} Not Allowed` });
  }

  if (!supabase) {
    if (req.method === 'GET') {
      return res.status(200).json({
        success: true,
        data: [],
        meta: { ...emptyMeta, degraded: true, reason: 'Supabase is not configured' },
      });
    }
    return res.status(503).json({
      success: false,
      error: 'Workflows are unavailable until Supabase is configured.',
      code: 'SUPABASE_NOT_CONFIGURED',
    });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      if (req.method === 'GET') {
        return res.status(200).json({ success: true, data: [], meta: emptyMeta });
      }
      return res.status(401).json({ success: false, error: 'Sign in before creating a workflow.' });
    }

    if (req.method === 'GET') {
      const { data: workflows, error } = await supabase
        .from('workflows')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('[Workflows] Table unavailable; returning empty list:', error.message);
        return res.status(200).json({ success: true, data: [], meta: { ...emptyMeta, degraded: true } });
      }

      const transformedWorkflows = (workflows || []).map((workflow: any) => ({
        id: workflow.id,
        name: workflow.name,
        trigger: { app: workflow.trigger_app, event: workflow.trigger_event },
        actions: (workflow.actions || []).map((action: any) => ({
          app: action.app,
          task: action.action || action.task,
        })),
        active: workflow.enabled,
        createdAt: new Date(workflow.created_at).toISOString(),
        updatedAt: workflow.updated_at ? new Date(workflow.updated_at).toISOString() : undefined,
        executions: workflow.execution_count || 0,
      }));

      return res.status(200).json({
        success: true,
        data: transformedWorkflows,
        meta: {
          total: transformedWorkflows.length,
          active: transformedWorkflows.filter((workflow) => workflow.active).length,
          totalExecutions: transformedWorkflows.reduce((sum, workflow) => sum + (workflow.executions || 0), 0),
        },
      });
    }

    const { name, trigger, actions } = req.body || {};
    if (!name || !trigger?.app || !trigger?.event || !Array.isArray(actions) || actions.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, trigger.app, trigger.event, actions',
      });
    }

    const { data: connectedApp } = await supabase
      .from('app_tokens')
      .select('connected')
      .eq('user_id', userId)
      .eq('app_name', String(trigger.app).toLowerCase())
      .maybeSingle();

    if (!connectedApp?.connected) {
      return res.status(400).json({
        success: false,
        error: `${trigger.app} is not connected. Please connect it first.`,
      });
    }

    const { data: workflow, error: createError } = await supabase
      .from('workflows')
      .insert({
        user_id: userId,
        name,
        trigger_app: trigger.app,
        trigger_event: trigger.event,
        trigger_config: trigger.config || {},
        actions: actions.map((action: any) => ({
          app: action.app,
          action: action.task || action.action,
          config: action.config || {},
        })),
        enabled: true,
      })
      .select()
      .single();

    if (createError || !workflow) {
      console.error('Failed to create workflow:', createError);
      return res.status(500).json({ success: false, error: 'Failed to create workflow' });
    }

    return res.status(201).json({
      success: true,
      data: {
        id: workflow.id,
        name: workflow.name,
        trigger: { app: workflow.trigger_app, event: workflow.trigger_event },
        actions: (workflow.actions || []).map((action: any) => ({ app: action.app, task: action.action })),
        active: workflow.enabled,
        createdAt: new Date(workflow.created_at).toISOString(),
        executions: 0,
      },
      message: 'Workflow created successfully',
    });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined,
    });
  }
}
