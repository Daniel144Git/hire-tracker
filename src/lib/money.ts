/**
 * Rounds a money amount to the penny (2 decimals), half away from zero.
 *
 * Why not just Math.round(value * 100) / 100:
 * - Floating point: 1.005 * 100 is 100.49999999999999, which would round down to 1.00.
 *   toPrecision(15) drops that representation noise first, so we get 100.5 and round to 1.01.
 * - Negative amounts: Math.round(-100.5) is -100 (it rounds towards +infinity). Credit notes must
 *   mirror charges, so we round the absolute value and put the sign back.
 * - A tiny negative amount would otherwise become -0; adding 0 normalises it to 0.
 */
export function round2(value: number): number {
  const pence = Number((Math.abs(value) * 100).toPrecision(15));
  return Math.sign(value) * (Math.round(pence) / 100) + 0;
}
