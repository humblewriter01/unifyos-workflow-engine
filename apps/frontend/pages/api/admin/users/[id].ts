import type { NextApiRequest, NextApiResponse } from 'next';
import { adminActor, requireAdmin } from '../../../../lib/admin-auth';
import { AUDIT_ACTIONS, logAdminEvent } from '../../../../lib/admin-events';
import prisma from '../../../../lib/prisma';

const roles = ['NONE', 'SUPPORT_READONLY', 'BILLING_ADMIN', 'CATALOG_ADMIN', 'SUPER_ADMIN'] as const;
const plans = ['FREE', 'PRO', 'BUSINESS'] as const;

/**
 * GET   — user drill-down: profile, workflows, tokens, subscription, payments.
 * PATCH — role / plan / email verification, plus manual subscription changes:
 *           { extendSubscriptionDays: number }  extend the current period
 *           { subscriptionPeriodEnd: ISO date } set the period end exactly
 *
 * Manual plan grants are intentionally just `User.plan`: that is the field the
 * product reads for entitlements, and it is independent of Paystack billing, so
 * "give this user PRO for free" needs no payment.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireAdmin(req, res, ['SUPER_ADMIN']);
  if (!admin) return;

  const id = typeof req.query.id === 'string' ? req.query.id : '';
  if (!id) {
    return res.status(400).json({ success: false, error: { code: 'USER_ID_REQUIRED', message: 'A user id is required.' } });
  }

  if (req.method === 'GET') {
    try {
      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          name: true,
          plan: true,
          adminRole: true,
          emailVerified: true,
          twoFactorEnabled: true,
          createdAt: true,
          updatedAt: true,
          lastLoginAt: true,
          _count: { select: { workflows: true, notifications: true, payments: true } },
          appTokens: { select: { appName: true, connected: true, expiresAt: true, lastUsedAt: true } },
          subscriptions: {
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: {
              id: true,
              status: true,
              currentPeriodStart: true,
              currentPeriodEnd: true,
              cancelAtPeriodEnd: true,
              plan: { select: { id: true, key: true, name: true } },
            },
          },
          payments: {
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: { id: true, reference: true, amount: true, currency: true, status: true, createdAt: true },
          },
          workflows: {
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: { id: true, name: true, enabled: true, executionCount: true, lastExecutedAt: true },
          },
        },
      });
      if (!user) {
        return res.status(404).json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found.' } });
      }

      const [audit, executions] = await Promise.all([
        prisma.adminAuditLog.findMany({
          where: { targetType: 'user', targetId: id },
          orderBy: { createdAt: 'desc' },
          take: 15,
          select: { id: true, action: true, adminEmail: true, createdAt: true, metadata: true },
        }),
        prisma.workflowExecution.count({ where: { workflow: { userId: id } } }),
      ]);

      return res.status(200).json({
        success: true,
        data: {
          ...user,
          executionCount: executions,
          recentAdminActions: audit,
        },
      });
    } catch (error) {
      console.error('Admin user detail error:', error);
      return res.status(503).json({
        success: false,
        error: { code: 'ADMIN_USER_UNAVAILABLE', message: 'That user is temporarily unavailable.' },
      });
    }
  }

  if (req.method !== 'PATCH') {
    res.setHeader('Allow', ['GET', 'PATCH']);
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' } });
  }

  const nextRole = typeof req.body?.adminRole === 'string' ? req.body.adminRole : undefined;
  const nextPlan = typeof req.body?.plan === 'string' ? req.body.plan : undefined;
  const emailVerified = typeof req.body?.emailVerified === 'boolean' ? req.body.emailVerified : undefined;
  const extendDaysRaw = req.body?.extendSubscriptionDays;
  const periodEndRaw = req.body?.subscriptionPeriodEnd;

  if (nextRole && !roles.includes(nextRole as (typeof roles)[number])) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_ROLE', message: 'Invalid administrator role.' } });
  }
  if (nextPlan && !plans.includes(nextPlan as (typeof plans)[number])) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_PLAN', message: 'Invalid account plan.' } });
  }
  if (nextRole && id === admin.id && nextRole !== 'SUPER_ADMIN') {
    return res.status(409).json({ success: false, error: { code: 'SELF_LOCKOUT_PREVENTED', message: 'You cannot remove your own SUPER_ADMIN role.' } });
  }

  const extendDays =
    extendDaysRaw === undefined || extendDaysRaw === null || extendDaysRaw === ''
      ? undefined
      : Number(extendDaysRaw);
  if (extendDays !== undefined && (!Number.isInteger(extendDays) || extendDays < -3650 || extendDays > 3650 || extendDays === 0)) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_EXTENSION', message: 'extendSubscriptionDays must be a non-zero whole number between -3650 and 3650.' },
    });
  }

  let periodEnd: Date | undefined;
  if (typeof periodEndRaw === 'string' && periodEndRaw) {
    const parsed = new Date(periodEndRaw);
    if (Number.isNaN(parsed.getTime())) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_PERIOD_END', message: 'subscriptionPeriodEnd is not a valid date.' } });
    }
    periodEnd = parsed;
  }

  const wantsAccountChange = Boolean(nextRole || nextPlan || emailVerified !== undefined);
  if (!wantsAccountChange && extendDays === undefined && !periodEnd) {
    return res.status(400).json({
      success: false,
      error: { code: 'NO_CHANGES', message: 'Provide an admin role, plan, verification, or subscription change.' },
    });
  }

  try {
    const current = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, adminRole: true, plan: true, emailVerified: true },
    });
    if (!current) {
      return res.status(404).json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found.' } });
    }

    let updated = current;
    if (wantsAccountChange) {
      updated = await prisma.user.update({
        where: { id },
        data: {
          ...(nextRole ? { adminRole: nextRole as any } : {}),
          ...(nextPlan ? { plan: nextPlan as any } : {}),
          ...(emailVerified === undefined ? {} : { emailVerified }),
        },
        select: { id: true, email: true, adminRole: true, plan: true, emailVerified: true },
      });
    }

    // Subscription adjustments -------------------------------------------------
    let subscription: { id: string; currentPeriodEnd: Date | null } | null = null;
    if (extendDays !== undefined || periodEnd) {
      const active = await prisma.subscription.findFirst({
        where: { userId: id, status: { in: ['ACTIVE', 'PAST_DUE', 'GRACE_PERIOD'] } },
        orderBy: { createdAt: 'desc' },
        select: { id: true, currentPeriodEnd: true },
      });
      if (!active) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'NO_SUBSCRIPTION',
            message: 'This user has no active subscription to extend. Grant the plan with the Plan field instead.',
          },
        });
      }

      let nextEnd: Date;
      if (periodEnd) {
        nextEnd = periodEnd;
      } else {
        const base = active.currentPeriodEnd && active.currentPeriodEnd > new Date() ? active.currentPeriodEnd : new Date();
        nextEnd = new Date(base.getTime() + (extendDays as number) * 24 * 60 * 60 * 1000);
      }

      subscription = await prisma.subscription.update({
        where: { id: active.id },
        data: { currentPeriodEnd: nextEnd },
        select: { id: true, currentPeriodEnd: true },
      });

      await logAdminEvent({
        actor: adminActor(admin),
        action: AUDIT_ACTIONS.subscriptionExtended,
        targetType: 'user',
        targetId: id,
        metadata: {
          email: current.email,
          subscriptionId: active.id,
          from: active.currentPeriodEnd?.toISOString() ?? null,
          to: nextEnd.toISOString(),
          mode: periodEnd ? 'set_end' : 'extend_days',
          days: extendDays ?? null,
        },
        req,
      });
    }

    // Account changes ---------------------------------------------------------
    if (nextPlan && nextPlan !== current.plan) {
      await logAdminEvent({
        actor: adminActor(admin),
        action: AUDIT_ACTIONS.userPlanChanged,
        targetType: 'user',
        targetId: id,
        metadata: { email: current.email, from: current.plan, to: nextPlan, manualGrant: true },
        req,
      });
    }
    if (nextRole && nextRole !== current.adminRole) {
      await logAdminEvent({
        actor: adminActor(admin),
        action: AUDIT_ACTIONS.userRoleChanged,
        targetType: 'user',
        targetId: id,
        metadata: { email: current.email, from: current.adminRole, to: nextRole },
        req,
      });
    }
    if (emailVerified !== undefined && emailVerified !== current.emailVerified) {
      await logAdminEvent({
        actor: adminActor(admin),
        action: 'admin.user.verification_changed',
        targetType: 'user',
        targetId: id,
        metadata: { email: current.email, from: current.emailVerified, to: emailVerified },
        req,
      });
    }

    return res.status(200).json({
      success: true,
      data: { ...updated, subscription },
      message: 'User updated.',
    });
  } catch (error) {
    console.error('Admin user update error:', error);
    return res.status(503).json({
      success: false,
      error: { code: 'ADMIN_USER_UPDATE_UNAVAILABLE', message: 'User administration is temporarily unavailable.' },
    });
  }
}
