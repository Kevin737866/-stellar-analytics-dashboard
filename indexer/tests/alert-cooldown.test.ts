import { shouldEmitAlert } from '../src/alert-cooldown';

describe('shouldEmitAlert', () => {
  const cooldown = 5 * 60 * 1000;
  const now = new Date('2026-01-01T00:10:00Z');

  it('emits the first alert when none has been sent', () => {
    expect(shouldEmitAlert(null, now, cooldown)).toBe(true);
  });

  it('suppresses alerts within the cooldown window', () => {
    expect(shouldEmitAlert(new Date(now.getTime() - 60_000), now, cooldown)).toBe(false);
  });

  it('emits again once the cooldown has elapsed', () => {
    expect(shouldEmitAlert(new Date(now.getTime() - cooldown - 1), now, cooldown)).toBe(true);
  });
});
