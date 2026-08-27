const DEFAULT_LAG_THRESHOLD_LEDGERS = 50;

/**
 * Tracks indexer lag (current chain head vs. last indexed ledger) and
 * reports whether the indexer is within acceptable operational bounds.
 */
class IndexerLagMonitor {
  constructor({
    thresholdLedgers = Number(process.env.INDEXER_LAG_THRESHOLD_LEDGERS) || DEFAULT_LAG_THRESHOLD_LEDGERS,
    onThresholdExceeded = () => {},
    onRecovered = () => {},
  } = {}) {
    this.thresholdLedgers = thresholdLedgers;
    this.onThresholdExceeded = onThresholdExceeded;
    this.onRecovered = onRecovered;
    this.isLagging = false;
  }

  /**
   * Call this once per indexing cycle with the current chain head and
   * the last ledger the indexer has successfully processed.
   */
  check(currentHeadLedger, lastIndexedLedger) {
    const lag = currentHeadLedger - lastIndexedLedger;
    const exceeded = lag > this.thresholdLedgers;

    if (exceeded && !this.isLagging) {
      this.isLagging = true;
      this.onThresholdExceeded({ lag, threshold: this.thresholdLedgers, currentHeadLedger, lastIndexedLedger });
    } else if (!exceeded && this.isLagging) {
      this.isLagging = false;
      this.onRecovered({ lag, threshold: this.thresholdLedgers });
    }

    return { lag, isLagging: this.isLagging, threshold: this.thresholdLedgers };
  }
}

module.exports = { IndexerLagMonitor, DEFAULT_LAG_THRESHOLD_LEDGERS };