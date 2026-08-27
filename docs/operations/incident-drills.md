# Incident Drill Log

Operational record of backup restore, PITR, service restart, and rollback drills.

**Last Updated:** 2026-08-27  
**Owner:** Platform Engineering Team

---

## Drill Types

| Type | Description | Runbook reference |
|------|-------------|-------------------|
| Backup restore | Restore a dump into a staging database | `docs/backup-disaster-recovery.md` §Restore Procedure |
| PITR | Point-in-time recovery from WAL archives | `docs/backup-disaster-recovery.md` §PITR Procedure |
| Full service restart | Restart indexer, API, and frontend | `docs/incident-response-runbook.md` §7.1 |
| Deployment rollback | Revert a failed deployment | `docs/DEPLOYMENT_ROLLBACK.md` |
| Circuit breaker reset | Manual Horizon circuit breaker recovery | `docs/incident-response-runbook.md` §7.3 |

---

## Required Artifacts

Each drill entry must capture:

- Backup file used (if applicable) and checksum verification output
- Recovery target time (for PITR drills)
- Commands executed
- Validation query results or health-check output
- Duration and pass/fail outcome
- Remediation actions (if any)

---

## Drill Log

| Date | Drill type | Participants | Environment | Duration | Result | Evidence |
|------|-----------|--------------|-------------|----------|--------|----------|
| 2026-08-27 | Backup verify | od-hunter | Local dev | ~2 min | Pass | `pnpm backup:verify` — checksum valid, archive listing succeeded |
| 2026-08-27 | Full service restart | od-hunter | Local dev | ~3 min | Pass | Indexer `/health` 200, API `/graphql` reachable, frontend loaded at `:5173` |

---

## Adding a New Entry

1. Run the drill following the linked runbook procedure.
2. Capture command output and validation results.
3. Add a row to the **Drill Log** table above with date, type, duration, and outcome.
4. Update **Last Updated** at the top of this file.

For automated backup verification evidence, see the daily `backup-verify` GitHub Actions workflow (`.github/workflows/backup-verify.yml`).
