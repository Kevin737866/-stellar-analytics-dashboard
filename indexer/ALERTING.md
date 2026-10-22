# Stellar Analytics Indexer - Alerting System

**Issue #143** – Add alerting for indexer errors

The indexer now includes a comprehensive alerting system that sends notifications through multiple channels (Slack, Email) when critical errors occur.

## Overview

The alerting system monitors:

- **Circuit breaker failures** - When the Horizon API circuit breaker opens
- **Database connection errors** - When database health checks fail
- **High error rates** - When processing error rate exceeds configured threshold
- **Dead letter queue thresholds** - When failed ledger queue grows too large
- **Ledger processing failures** - When individual ledgers fail to process
- **Backfill job failures** - When backfill jobs encounter errors
- **Graceful shutdown** - Notifications when the indexer shuts down

## Configuration

### Environment Variables

Enable the alerting system and configure channels via environment variables:

```bash
# Enable/disable alerting system
ALERTING_ENABLED=true

# Slack Integration
SLACK_ALERTS_ENABLED=true
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
SLACK_ALERT_COOLDOWN_MS=300000  # 5 minutes (optional)

# Email Integration
EMAIL_ALERTS_ENABLED=true
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USER=your-email@gmail.com
EMAIL_SMTP_PASSWORD=your-app-password
EMAIL_FROM_ADDRESS=indexer@stellar-analytics.local
EMAIL_TO_ADDRESSES=ops@example.com,team@example.com
EMAIL_ALERT_COOLDOWN_MS=300000  # 5 minutes (optional)

# Alert Thresholds
ALERT_ERROR_RATE_PERCENT=10      # Alert if error rate > 10%
ALERT_DLQ_SIZE_THRESHOLD=100     # Alert if dead letter queue > 100 items
ALERT_CIRCUIT_BREAKER_OPEN=true  # Alert when circuit breaker opens
```

## Alert Channels

### Slack

Sends alerts to Slack via webhook with:
- Color-coded severity (Red=Critical, Orange=Warning, Green=Info)
- Formatted message with details
- Timestamp and service context

**Setup:**
1. Create a Slack App at https://api.slack.com/apps
2. Enable Incoming Webhooks
3. Create a webhook for your channel
4. Copy the webhook URL to `SLACK_WEBHOOK_URL`

Example alert in Slack:
```
[CRITICAL] Circuit Breaker Opened: Horizon API
Failed to connect to Stellar Horizon
Severity: CRITICAL
Service: Horizon API
Reason: Connection timeout
```

### Email

Sends alerts via SMTP with:
- HTML formatted message body
- Severity-based subject lines
- Detailed information in tables

**Setup (Gmail example):**
1. Enable 2-Factor Authentication on your Gmail account
2. Generate an App Password: https://myaccount.google.com/apppasswords
3. Set `EMAIL_SMTP_USER` to your email address
4. Set `EMAIL_SMTP_PASSWORD` to the 16-character app password
5. Use `smtp.gmail.com` and port `587` for `EMAIL_SMTP_HOST`/`EMAIL_SMTP_PORT`

Example alert email:
```
Subject: [CRITICAL] Database Connection Error

From: indexer@stellar-analytics.local
To: ops@example.com, team@example.com

Dear Operator,

The Stellar Analytics Indexer encountered a critical error:

Title: Database Connection Error
Severity: CRITICAL
Error: Connection refused on localhost:5432

Please investigate immediately.

Timestamp: 2024-01-15T10:30:00.000Z
Stellar Analytics Indexer
```

## Alert Thresholds

### Error Rate Alerting

Triggers when the percentage of failed processing cycles exceeds the threshold:

```bash
ALERT_ERROR_RATE_PERCENT=10  # Alert if > 10% of cycles fail
```

### Dead Letter Queue (DLQ) Size

Triggers when the number of failed ledgers awaiting retry exceeds threshold:

```bash
ALERT_DLQ_SIZE_THRESHOLD=100  # Alert if > 100 failed ledgers
```

### Circuit Breaker

Triggers when the circuit breaker for Horizon API opens due to repeated failures:

```bash
ALERT_CIRCUIT_BREAKER_OPEN=true  # Send alert when breaker opens
```

## Cooldown Period

To prevent alert spam, each alert type has a cooldown period after being sent. The same alert won't be sent again until the cooldown expires:

- **Default:** 5 minutes (300,000 ms)
- **Configurable per channel:**
  - `SLACK_ALERT_COOLDOWN_MS`
  - `EMAIL_ALERT_COOLDOWN_MS`

The first database or Horizon health-check failure always emits an alert immediately; the cooldown only applies to subsequent failures and resets after a successful check.

Health checks honor `STELLAR_MOCK=true` and probe the built-in mock Horizon server instead of the live network.

## Integration Points

### In Code

The alerting service is automatically initialized when the indexer starts:

```typescript
import { initializeAlertService, alertService } from './alerting';

// Initialize with config
const config = validateConfig();
const alerts = initializeAlertService(config.alerting);

// Send alerts
await alertService.alertCircuitBreakerOpen('HorizonAPI', reason);
await alertService.alertDatabaseError(error, context);
await alertService.alertHighErrorRate(errorRate, cycleCount, errorCount);
```

### Automatic Alert Points

1. **Polling Cycle** (`runCycle()`)
   - Alerts on ledger processing errors
   - Alerts when error rate exceeds threshold

2. **Health Checks**
   - Alerts on database connection failures
   - Alerts on Horizon API failures

3. **Graceful Shutdown**
   - Sends notification when indexer shuts down

## Testing

Run the alert service tests:

```bash
pnpm test -- src/alerting/__tests__/AlertService.test.ts
```

Test individual providers:

```bash
pnpm test -- src/alerting/__tests__/AlertService.test.ts --testNamePattern="SlackAlertProvider"
pnpm test -- src/alerting/__tests__/AlertService.test.ts --testNamePattern="EmailAlertProvider"
```

## Troubleshooting

### Alerts not sending

1. **Check if alerting is enabled:**
   ```bash
   grep "ALERTING_ENABLED" .env
   ```

2. **Check logs for alert errors:**
   ```bash
   grep "alerting" logs/indexer.log
   ```

3. **Verify provider configuration:**
   ```bash
   # For Slack
   curl -X POST -H 'Content-type: application/json' \
     --data '{"text":"Test"}' \
     $SLACK_WEBHOOK_URL

   # For Email
   telnet $EMAIL_SMTP_HOST $EMAIL_SMTP_PORT
   ```

### Slack webhook not working

- Verify webhook URL is correct and hasn't expired
- Check webhook is enabled in Slack App settings
- Ensure firewall allows outbound HTTPS connections

### Email not sending

- Verify SMTP credentials are correct
- For Gmail: Check App Password is 16 characters without spaces
- Ensure SMTP port is accessible (587 or 465)
- Check email recipient addresses are valid

## Best Practices

1. **Start conservative with thresholds** - Set alert thresholds high initially and lower them as you understand normal operations

2. **Use multiple channels** - Enable both Slack (fast notification) and Email (persistent record)

3. **Monitor alert logs** - Keep track of which alerts are firing and adjust thresholds accordingly

4. **Test alerting** - After configuration, manually trigger an alert to verify it works:
   ```bash
   # In Node REPL
   const { alertService } = require('./dist/alerting');
   await alertService?.alertGracefulShutdown('TEST');
   ```

5. **Set appropriate cooldowns** - Balance between being notified of issues and not getting spammed

6. **Use escalation** - Configure different recipients or channels for different severity levels in future updates

## Future Enhancements

Potential future alert channels and features:

- **PagerDuty integration** - For on-call escalation
- **Webhook support** - Send to custom endpoints
- **Severity-based routing** - Different channels for different severity levels
- **Aggregated alerts** - Batch similar alerts together
- **Custom alert templates** - Customize message format per channel
- **Alert acknowledgment** - Track and acknowledge alerts

## See Also

- [Configuration Guide](../CONFIGURATION.md)
- [Error Handling](../error-handling-and-logging.md)
- [Health Checks](../health-checks.md)
