import prisma from './prisma';

/**
 * Promo code validation and discount maths.
 *
 * Amounts are always **integer minor units**, matching `Payment.amount` and what
 * Paystack is charged. A discount can never take an order to zero: Paystack
 * cannot charge `0`, so the maximum discount leaves 1 minor unit payable. Codes
 * that would make an order free are rejected with `PROMO_MAKES_FREE` — grant the
 * plan manually instead.
 */

export type PromoErrorCode =
  | 'PROMO_NOT_FOUND'
  | 'PROMO_INACTIVE'
  | 'PROMO_NOT_STARTED'
  | 'PROMO_EXPIRED'
  | 'PROMO_EXHAUSTED'
  | 'PROMO_ALREADY_USED'
  | 'PROMO_CURRENCY_MISMATCH'
  | 'PROMO_MAKES_FREE'
  | 'PROMO_NOT_APPLICABLE';

export interface PromoQuote {
  code: string;
  discountType: 'PERCENTAGE' | 'FLAT';
  discountValue: number;
  discountAmount: number;
  finalAmount: number;
  currency: string;
}

export type PromoFailure = { ok: false; code: PromoErrorCode; message: string };
export type PromoSuccess = { ok: true; quote: PromoQuote };
export type PromoResult = PromoSuccess | PromoFailure;

/**
 * Type guard rather than a bare `if (!result.ok)` check.
 *
 * `tsconfig.json` has `strict: false`, and without `strictNullChecks`
 * TypeScript does not narrow a boolean-literal discriminated union after
 * `if (!result.ok)`. A user-defined predicate narrows regardless.
 */
export function isPromoFailure(result: PromoResult): result is PromoFailure {
  return result.ok === false;
}

export function isPromoSuccess(result: PromoResult): result is PromoSuccess {
  return result.ok === true;
}

const MESSAGES: Record<PromoErrorCode, string> = {
  PROMO_NOT_FOUND: 'That promo code does not exist.',
  PROMO_INACTIVE: 'That promo code is no longer active.',
  PROMO_NOT_STARTED: 'That promo code is not active yet.',
  PROMO_EXPIRED: 'That promo code has expired.',
  PROMO_EXHAUSTED: 'That promo code has reached its usage limit.',
  PROMO_ALREADY_USED: 'You have already used that promo code.',
  PROMO_CURRENCY_MISMATCH: 'That promo code is not valid for this currency.',
  PROMO_MAKES_FREE: 'That promo code would make the order free. Ask an administrator to grant the plan instead.',
  PROMO_NOT_APPLICABLE: 'That promo code cannot be applied to this order.',
};

export function normalizePromoCode(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().toUpperCase().replace(/\s+/g, '') : '';
}

/** Discount in minor units, clamped so at least 1 minor unit remains payable. */
export function computeDiscount(
  promo: { discountType: 'PERCENTAGE' | 'FLAT'; discountValue: number },
  amount: number,
): number {
  if (!Number.isInteger(amount) || amount <= 1) return 0;
  const raw =
    promo.discountType === 'PERCENTAGE'
      ? Math.round((amount * promo.discountValue) / 100)
      : promo.discountValue;
  return Math.max(0, Math.min(raw, amount - 1));
}

export async function quotePromoCode(input: {
  code: unknown;
  amount: number;
  currency: string;
  userId: string;
}): Promise<PromoResult> {
  const code = normalizePromoCode(input.code);
  if (!code) return { ok: false, code: 'PROMO_NOT_FOUND', message: MESSAGES.PROMO_NOT_FOUND };

  const promo = await prisma.promoCode.findUnique({ where: { code } });
  if (!promo) return { ok: false, code: 'PROMO_NOT_FOUND', message: MESSAGES.PROMO_NOT_FOUND };

  const now = new Date();
  if (!promo.active) return { ok: false, code: 'PROMO_INACTIVE', message: MESSAGES.PROMO_INACTIVE };
  if (promo.startsAt && promo.startsAt > now) return { ok: false, code: 'PROMO_NOT_STARTED', message: MESSAGES.PROMO_NOT_STARTED };
  if (promo.expiresAt && promo.expiresAt <= now) return { ok: false, code: 'PROMO_EXPIRED', message: MESSAGES.PROMO_EXPIRED };
  if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
    return { ok: false, code: 'PROMO_EXHAUSTED', message: MESSAGES.PROMO_EXHAUSTED };
  }
  if (promo.maxUsesPerUser > 0 && promo.redeemedUserIds.includes(input.userId)) {
    return { ok: false, code: 'PROMO_ALREADY_USED', message: MESSAGES.PROMO_ALREADY_USED };
  }
  if (promo.discountType === 'FLAT' && promo.currency && promo.currency.toUpperCase() !== input.currency.toUpperCase()) {
    return { ok: false, code: 'PROMO_CURRENCY_MISMATCH', message: MESSAGES.PROMO_CURRENCY_MISMATCH };
  }
  if (promo.discountType === 'PERCENTAGE' && (promo.discountValue < 1 || promo.discountValue > 100)) {
    return { ok: false, code: 'PROMO_NOT_APPLICABLE', message: MESSAGES.PROMO_NOT_APPLICABLE };
  }

  const discountAmount = computeDiscount(
    { discountType: promo.discountType, discountValue: promo.discountValue },
    input.amount,
  );
  const finalAmount = input.amount - discountAmount;

  if (finalAmount <= 0) return { ok: false, code: 'PROMO_MAKES_FREE', message: MESSAGES.PROMO_MAKES_FREE };
  if (discountAmount <= 0) return { ok: false, code: 'PROMO_NOT_APPLICABLE', message: MESSAGES.PROMO_NOT_APPLICABLE };

  return {
    ok: true,
    quote: {
      code: promo.code,
      discountType: promo.discountType,
      discountValue: promo.discountValue,
      discountAmount,
      finalAmount,
      currency: input.currency,
    },
  };
}

/**
 * Records a redemption. Idempotent per user: both `verify.ts` and the Paystack
 * webhook can mark the same payment successful, and only one may count.
 */
export async function redeemPromoCode(code: string, userId: string): Promise<boolean> {
  const normalized = normalizePromoCode(code);
  if (!normalized) return false;
  const promo = await prisma.promoCode.findUnique({ where: { code: normalized } });
  if (!promo) return false;
  if (promo.redeemedUserIds.includes(userId)) return false;

  try {
    await prisma.promoCode.update({
      where: { id: promo.id },
      data: { usedCount: { increment: 1 }, redeemedUserIds: { push: userId } },
    });
    return true;
  } catch (error) {
    console.error('[promo] redemption failed', error instanceof Error ? error.message : error);
    return false;
  }
}

export { MESSAGES as PROMO_MESSAGES };
