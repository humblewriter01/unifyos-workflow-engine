import type { NextApiRequest, NextApiResponse } from 'next';
import { adminActor, requireAdmin } from '../../../../lib/admin-auth';
import { AUDIT_ACTIONS, logAdminEvent } from '../../../../lib/admin-events';
import prisma from '../../../../lib/prisma';

/**
 * PATCH — toggle a code (`{ active: boolean }`) or extend its expiry
 *         (`{ expiresAt: ISO | null }`).
 * DELETE — remove a code that has never been redeemed. Codes with redemptions
 *          are deactivated instead so payment history stays explainable.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireAdmin(req, res, ['SUPER_ADMIN', 'BILLING_ADMIN']);
  if (!admin) return;

  const id = typeof req.query.id === 'string' ? req.query.id : '';
  if (!id) {
    return res.status(400).json({ success: false, error: { code: 'PROMO_ID_REQUIRED', message: 'A promo code id is required.' } });
  }

  try {
    const promo = await prisma.promoCode.findUnique({ where: { id } });
    if (!promo) {
      return res.status(404).json({ success: false, error: { code: 'PROMO_NOT_FOUND', message: 'Promo code not found.' } });
    }

    if (req.method === 'PATCH') {
      const data: { active?: boolean; expiresAt?: Date | null; description?: string | null } = {};

      if (typeof req.body?.active === 'boolean') data.active = req.body.active;
      if (typeof req.body?.description === 'string' || req.body?.description === null) {
        data.description = typeof req.body.description === 'string' ? req.body.description.trim().slice(0, 200) : null;
      }
      if (req.body?.expiresAt !== undefined) {
        if (req.body.expiresAt === null || req.body.expiresAt === '') {
          data.expiresAt = null;
        } else {
          const parsed = new Date(String(req.body.expiresAt));
          if (Number.isNaN(parsed.getTime())) {
            return res.status(400).json({ success: false, error: { code: 'INVALID_DATE', message: 'Expiry must be a valid date or null.' } });
          }
          data.expiresAt = parsed;
        }
      }

      if (Object.keys(data).length === 0) {
        return res.status(400).json({ success: false, error: { code: 'NO_CHANGES', message: 'Provide active, expiresAt, or description.' } });
      }

      const updated = await prisma.promoCode.update({ where: { id }, data });
      await logAdminEvent({
        actor: adminActor(admin),
        action: AUDIT_ACTIONS.promoCodeUpdated,
        targetType: 'promo_code',
        targetId: promo.id,
        metadata: { code: promo.code, patch: { ...data, expiresAt: data.expiresAt ? data.expiresAt.toISOString() : data.expiresAt ?? undefined } },
        req,
      });

      return res.status(200).json({ success: true, data: updated, message: `${promo.code} updated.` });
    }

    if (req.method === 'DELETE') {
      if (promo.usedCount > 0) {
        const updated = await prisma.promoCode.update({ where: { id }, data: { active: false } });
        await logAdminEvent({
          actor: adminActor(admin),
          action: AUDIT_ACTIONS.promoCodeUpdated,
          targetType: 'promo_code',
          targetId: promo.id,
          metadata: { code: promo.code, deactivatedInsteadOfDelete: true, usedCount: promo.usedCount },
          req,
        });
        return res.status(200).json({
          success: true,
          data: updated,
          message: `${promo.code} has redemptions, so it was deactivated instead of deleted.`,
        });
      }

      await prisma.promoCode.delete({ where: { id } });
      await logAdminEvent({
        actor: adminActor(admin),
        action: AUDIT_ACTIONS.promoCodeDeleted,
        targetType: 'promo_code',
        targetId: promo.id,
        metadata: { code: promo.code },
        req,
      });
      return res.status(200).json({ success: true, data: { id }, message: `${promo.code} deleted.` });
    }

    res.setHeader('Allow', ['PATCH', 'DELETE']);
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' } });
  } catch (error) {
    console.error('Promo update error:', error);
    return res.status(503).json({
      success: false,
      error: { code: 'PROMO_UPDATE_UNAVAILABLE', message: 'The promo code could not be updated.' },
    });
  }
}
