setUserRole: async (_parent, { userId, role }, context) => {
  return db.transaction(async (tx) => {
    const { rows } = await tx.query(
      'SELECT role FROM users WHERE id = $1 FOR UPDATE',
      [userId]
    );
    const previousRole = rows[0].role;

    await tx.query('UPDATE users SET role = $1 WHERE id = $2', [role, userId]);

    await recordRoleChangeAudit(tx, {
      userId,
      changedBy: context.currentUser.id,
      previousRole,
      newRole: role,
    });

    return { id: userId, role };
  });
},