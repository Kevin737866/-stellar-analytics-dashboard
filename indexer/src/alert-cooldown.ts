/**
 * Returns true when an alert should be emitted: either no alert has been sent
 * yet (first failure) or the cooldown since the last alert has elapsed.
 */
export function shouldEmitAlert(lastAlertAt: Date | null, now: Date, cooldownMs: number): boolean {
  return !lastAlertAt || now.getTime() - lastAlertAt.getTime() > cooldownMs;
}
