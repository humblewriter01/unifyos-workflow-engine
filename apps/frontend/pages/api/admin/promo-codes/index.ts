import type { NextApiRequest, NextApiResponse } from 'next';
import { adminActor, requireAdmin } from '../../../../lib/admin-auth';
import { AUDIT_ACTIONS, logAdminEvent } from '../../../../lib/admin-events';
import { normalizePromoCode } from '../../../../lib/promo-codes';
import prisma from '../../../../lib/prisma';

/**
 * Promo code management.
 *
 * GET  — list every code with usage stats.
 * POST — create one: { code, discountType, discountValue, maxUses?, maxUsesPerUser?,
 *                       currency?, startsAt?, expiresAt?, description? }
 *
 * `discountValue` is a whole percent (1–100) for PERCENTAGE and **minor units**
 * for FLAT, which is the same unit as `Payment.amount`.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireAdmin(req, res, ['SUPER_ADMIN', 'BILLING_ADMIN']);
  if (!admin) return;

  if (req.method === 'GET') {
    try {
      const [codes, redemptions] = await Promise.all([
        prisma.promoCode.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }),
        prisma.adminAuditLog.count({ where: { action: AUDIT_ACTIONS.promoCodeRedeemed } }),
      ]);
      return res.status(200).json({ success: true, data: codes, meta: { totalRedemptions: redemptions } });
    } catch (error) {
      console.error('Promo list error:', error);
      return res.status(503).json({
        success: false,
        error: { code: 'PROMO_UNAVAILABLE', message: 'Promo codes are temporarily unavailable.' },
      });
    }
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' } });
  }

  const code = normalizePromoCode(req.body?.code);
  const discountType = req.body?.discountType;
  const discountValue = Number(req.body?.discountValue);

  if (!code || !/^[A-Z0-9_-]{3,32}$/.test(code)) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_CODE', message: 'Use 3–32 characters: letters, numbers, hyphen or underscore.' },
    });
  }
  if (discountType !== 'PERCENTAGE' && discountType !== 'FLAT') {
    return res.status(400).json({ success: false, error: { code: 'INVALID_DISCOUNT_TYPE', message: 'Discount type must be PERCENTAGE or FLAT.' } });
  }
  if (!Number.isInteger(discountValue) || discountValue <= 0) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_DISCOUNT_VALUE', message: 'Discount value must be a whole number above zero.' } });
  }
  if (discountType === 'PERCENTAGE' && discountValue > 100) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_DISCOUNT_VALUE', message: 'A percentage discount cannot exceed 100.' } });
  }

  const maxUses = req.body?.maxUses === '' || req.body?.maxUses === undefined || req.body?.maxUses === null ? null : Number(req.body.maxUses);
  if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1)) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_MAX_USES', message: 'Max uses must be a whole number of at least 1, or empty for unlimited.' } });
  }

  const maxUsesPerUserRaw = req.body?.maxUsesPerUser;
  const maxUsesPerUser = maxUsesPerUserRaw === undefined || maxUsesPerUserRaw === '' || maxUsesPerUserRaw === null ? 1 : Number(maxUsesPerUserRaw);
  if (!Number.isInteger(maxUsesPerUser) || maxUsesPerUser < 0 || maxUsesPerUser > 100) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_PER_USER_LIMIT', message: 'Uses per user must be 0 (unlimited) to 100.' } });
  }

  const parseDate = (value: unknown): Date | null | undefined => {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value !== 'string') return undefined;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  };
  const startsAt = parseDate(req.body?.startsAt);
  const expiresAt = parseDate(req.body?.expiresAt);
  if (startsAt === undefined || expiresAt === undefined) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_DATE', message: 'Start and expiry must be valid dates.' } });
  }
  if (startsAt && expiresAt && expiresAt <= startsAt) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_DATE_RANGE', message: 'Expiry must be after the start date.' } });
  }

  const currency = typeof req.body?.currency === 'string' && req.body.currency.trim() ? req.body.currency.trim().toUpperCase().slice(0, 3) : 'NGN';
  if (discountType === 'FLAT' && !/^[A-Z]{3}$/.test(currency)) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_CURRENCY', message: 'Currency must be a three-letter code such as NGN or USD.' } });
  }

  const description = typeof req.body?.description === 'string' ? req.body.description.trim().slice(0, 200) : null;

  try {
    const existing = await prisma.promoCode.findUnique({ where: { code }, select: { id: true } });
    if (existing) {
      return res.status(409).json({ success: false, error: { code: 'PROMO_EXISTS', message: 'That promo code already exists.' } });
    }

    const promo = await prisma.promoCode.create({
      data: {
        code,
        description,
        discountType,
        discountValue,
        currency,
        maxUses,
        maxUsesPerUser,
        startsAt,
        expiresAt,
        createdBy: admin.email,
        active: true,
      },
    });

    await logAdminEvent({
      actor: adminActor(admin),
      action: AUDIT_ACTIONS.promoCodeCreated,
      targetType: 'promo_code',
      targetId: promo.id,
      metadata: {
        code: promo.code,
        discountType,
        discountValue,
        maxUses,
        maxUsesPerUser,
        expiresAt: expiresAt?.toISOString() ?? null,
        currency,
      },
      req,
    });

    return res.status(201).json({ success: true, data: promo, message: `${promo.code} created.` });
  } catch (error) {
    console.error('Promo create error:', error);
    return res.status(503).json({
      success: false,
      error: { code: 'PROMO_CREATE_UNAVAILABLE', message: 'The promo code could not be created.' },
    });
  }
}
