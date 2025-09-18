export async function seed({ entities, db, sql, logger }) {
  logger.info('42')
  await entities.graph.save({ input: { name: 'Hello' } })
  await db.query(sql`
    INSERT INTO graphs (name) VALUES ('Hello 2');
  `)
}
