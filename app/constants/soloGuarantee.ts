export const DEFAULT_SOLO_GUARANTEE_PRICE = 30_000;
export const MIN_SOLO_GUARANTEE_PRICE = 20_000;
export const MAX_SOLO_GUARANTEE_PRICE = 100_000;
export const SOLO_GUARANTEE_PRICE_STEP = 1_000;

// Backward-compatible alias for tests and legacy call sites that only need the default value.
export const SOLO_GUARANTEE_PRICE = DEFAULT_SOLO_GUARANTEE_PRICE;

export function isValidSoloGuaranteePrice(value: unknown) {
  const price = Number(value);

  return Number.isInteger(price)
    && price >= MIN_SOLO_GUARANTEE_PRICE
    && price <= MAX_SOLO_GUARANTEE_PRICE
    && price % SOLO_GUARANTEE_PRICE_STEP === 0;
}

export function normalizeSoloGuaranteePrice(
  value: unknown,
  fallback: number = DEFAULT_SOLO_GUARANTEE_PRICE
) {
  return isValidSoloGuaranteePrice(value) ? Number(value) : fallback;
}
