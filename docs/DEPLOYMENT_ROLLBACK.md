# Deployment Rollback Procedures

**Last Updated:** 2026-08-27  
**Last Verified:** 2026-08-27  
**Next Review:** 2026-11-27  
**Owner:** Platform Engineering Team

Issue #175: Step-by-step rollback procedures for API, frontend, and indexer deployments.

## Quick Reference

| Service | Rollback Command | Expected Downtime |
|---------|-----------------|-------------------|
| API | `kubectl rollout undo deployment/api -n stellar-insights` | < 1 min |
| Frontend | `kubectl rollout undo deployment/frontend -n stellar-insights` | < 30 sec |
| Indexer | `kubectl rollout undo deployment/indexer -n stellar-insights` | < 2 min |

## API Service Rollback

### 1. Check current deployment status
```bash
kubectl rollout status deployment/api -n stellar-insights
```

### 2. View rollout history
```bash
kubectl rollout history deployment/api -n stellar-insights
```

### 3. Rollback to previous version
```bash
kubectl rollout undo deployment/api -n stellar-insights
```

### 4. Rollback to specific revision
```bash
kubectl rollout undo deployment/api -n stellar-insights --to-revision=3
```

### 5. Verify rollback
```bash
kubectl rollout status deployment/api -n stellar-insights
kubectl get pods -l app=api -n stellar-insights
```

### 6. Database rollback (if migration was applied)
```bash
# Check migration status
kubectl exec -it <api-pod> -n stellar-insights -- pnpm migrate:status

# Rollback last migration
kubectl exec -it <api-pod> -n stellar-insights -- pnpm migrate:down
```

## Frontend Service Rollback

### 1. Check current deployment
```bash
kubectl rollout status deployment/frontend -n stellar-insights
```

### 2. Rollback
```bash
kubectl rollout undo deployment/frontend -n stellar-insights
```

### 3. Verify
```bash
kubectl rollout status deployment/frontend -n stellar-insights
# Verify the frontend is serving the previous build
curl -s https://stellar-insights.example.com | grep -o 'v[0-9.]*' | head -1
```

## Indexer Service Rollback

### 1. Check indexer status
```bash
kubectl rollout status deployment/indexer -n stellar-insights
```

### 2. Rollback
```bash
kubectl rollout undo deployment/indexer -n stellar-insights
```

### 3. Verify ingestion resumed
```bash
kubectl logs -l app=indexer -n stellar-insights --tail=20
# Check that new ledgers are being indexed
```

## PostgreSQL Rollback (Point-in-Time Recovery)

### 1. Identify the bad deployment time
```bash
# Check deployment timestamps
kubectl rollout history deployment/api -n stellar-insights
```

### 2. Restore from backup
```bash
# Using the WAL backup
kubectl exec -it <postgres-pod> -- pg_ctl reload
# For full PITR, use the cloud provider's backup restoration
```

## Redis Rollback

Redis is ephemeral (cache only) — no rollback needed. A restart clears all cached data:
```bash
kubectl rollout restart deployment/redis -n stellar-insights
```

## Emergency Full Rollback (All Services)

```bash
# Rollback all services simultaneously
kubectl rollout undo deployment/api -n stellar-insights
kubectl rollout undo deployment/frontend -n stellar-insights
kubectl rollout undo deployment/indexer -n stellar-insights

# Wait for all rollbacks to complete
kubectl rollout status deployment/api -n stellar-insights
kubectl rollout status deployment/frontend -n stellar-insights
kubectl rollout status deployment/indexer -n stellar-insights
```

## Post-Rollback Checklist

- [ ] All pods are running and healthy
- [ ] API health endpoint returns 200
- [ ] Frontend loads without errors
- [ ] Indexer is processing new ledgers
- [ ] No error spikes in monitoring dashboards
- [ ] Notify the team in Slack #stellar-insights channel
- [ ] Create a post-mortem issue for the failed deployment

## Rollback Verification Log

| Date | Procedure | Environment | Result | Notes |
|------|-----------|-------------|--------|-------|
| 2026-08-27 | Rollback procedure review | Documentation | Pass | kubectl commands verified against deployment manifests |
