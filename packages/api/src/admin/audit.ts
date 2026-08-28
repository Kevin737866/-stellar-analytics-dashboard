import type { PoolClient } from 'pg';
import winston from 'winston';

export interface RoleChangeAuditEntry {
  actorUserId: string;
  actorEmail: string;
  targetUserId: string;
  previousRole: string;
  newRole: string;
}

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

/**
 * Records an admin role change, both to the durable audit table (within the
 * SAME transaction as the role UPDATE — see resolvers.ts) and to the
 * structured request log, so it shows up alongside the existing "GraphQL
 * operation resolved" entries described in
 * docs/error-handling-and-logging.md.
 */
export async function recordRoleChangeAudit(client: PoolClient, entry: RoleChangeAuditEntry): Promise<void> {
  await client.query(
    `INSERT INTO admin_role_audit_log
       (actor_user_id, actor_email, target_user_id, previous_role, new_role)
     VALUES ($1, $2, $3, $4, $5)`,
    [entry.actorUserId, entry.actorEmail, entry.targetUserId, entry.previousRole, entry.newRole]
  );

  logger.info('Admin role change', {
    actorUserId: entry.actorUserId,
    actorEmail: entry.actorEmail,
    targetUserId: entry.targetUserId,
    previousRole: entry.previousRole,
    newRole: entry.newRole,
  });
}