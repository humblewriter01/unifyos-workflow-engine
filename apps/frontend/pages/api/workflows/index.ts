import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../lib/supabase';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { method } = req;

  try {
    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user?.id;

    if (!userId) {
      return res.status(200).json({
        success: true,
        data: [],
        meta: {
          total: 0,
          active: 0,
          totalExecutions: 0,
        },
      });
    }

    switch (method) {
      case 'GET':
        const { data: workflows, error } = await supabase
          .from('workflows')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Failed to fetch workflows:', error);
          return res.status(200).json({
            success: true,
            data: [],
            meta: {
              total: 0,
              active: 0,
              totalExecutions: 0,
            },
          });
        }

        const transformedWorkflows = (workflows || []).map((w: any) => ({
          id: w.id,
          name: w.name,
          trigger: {
            app: w.trigger_app,
            event: w.trigger_event,
          },
          actions: (w.actions || []).map((a: any) => ({
            app: a.app,
            task: a.action || a.task,
          })),
          active: w.enabled,
          createdAt: new Date(w.created_at).toISOString(),
          updatedAt: new Date(w.updated_at).toISOString(),
          executions: w.execution_count,
        }));

        const activeCount = workflows.filter((w: any) => w.enabled).length;

        return res.status(200).json({
          success: true,
          data: transformedWorkflows,
          meta: {
            total: workflows.length,
            active: activeCount,
            totalExecutions: workflows.reduce((sum: number, w: any) => sum + w.execution_count, 0),
          },
        });

      case 'POST':
        const { name, trigger, actions } = req.body;

        if (!name || !trigger || !actions || actions.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'Missing required fields: name, trigger, actions',
          });
        }

        const { data: connectedApp } = await supabase
          .from('app_tokens')
          .select('connected')
          .eq('user_id', userId)
          .eq('app_name', trigger.app.toLowerCase())
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
            actions: actions.map((a: any) => ({
              app: a.app,
              action: a.task || a.action,
              config: a.config || {},
            })),
            enabled: true,
          })
          .select()
          .single();

        if (createError) {
          console.error('Failed to create workflow:', createError);
          return res.status(500).json({
            success: false,
            error: 'Failed to create workflow',
          });
        }

        return res.status(201).json({
          success: true,
          data: {
            id: workflow.id,
            name: workflow.name,
            trigger: {
              app: workflow.trigger_app,
              event: workflow.trigger_event,
            },
            actions: (workflow.actions || []).map((a: any) => ({
              app: a.app,
              task: a.action,
            })),
            active: workflow.enabled,
            createdAt: new Date(workflow.created_at).toISOString(),
            executions: 0,
          },
          message: 'Workflow created successfully',
        });

      default:
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).json({
          success: false,
          error: `Method ${method} Not Allowed`,
        });
    }
  } catch (error: any) {
    console.error('API Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}
