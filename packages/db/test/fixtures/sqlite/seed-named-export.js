export async function seed ({ entities, db, sql, logger }) {
  logger.info('42')
  await entities.graph.insert({ input: { name: 'Hello' } })
  await db.query(sql`
    INSERT INTO graphs (name) VALUES ('Hello 2');
  `)
}
