'use strict'

const { clear, connInfo, isSQLite, isMysql, isPg } = require('./helper')
const { test } = require('tap')
const { connect } = require('..')
const fakeLogger = {
  trace: () => {},
  // trace: console.log,
  error: () => {}
}

test('composite primary keys', async ({ equal, same, teardown, rejects }) => {
  /* https://github.com/platformatic/platformatic/issues/299 */
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    teardown(() => db.dispose())

    if (isSQLite) {
      await db.query(sql`CREATE TABLE pages (
        id INTEGER PRIMARY KEY,
        the_title VARCHAR(42)
      );`)

      await db.query(sql`CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        username VARCHAR(255) NOT NULL
      );`)

      await db.query(sql`CREATE TABLE editors (
        page_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        role VARCHAR(255) NOT NULL,
        CONSTRAINT fk_editor_pages FOREIGN KEY (page_id) REFERENCES pages(id),
        CONSTRAINT fk_editor_users FOREIGN KEY (user_id) REFERENCES users(id),
        PRIMARY KEY (page_id, user_id)
      );`)
    } else if (isPg) {
      await db.query(sql`CREATE TABLE pages (
        id SERIAL PRIMARY KEY,
        the_title VARCHAR(255) NOT NULL
      );`)

      await db.query(sql`CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) NOT NULL
      );`)

      await db.query(sql`CREATE TABLE editors (
        page_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        role VARCHAR(255) NOT NULL,
        CONSTRAINT fk_editor_pages FOREIGN KEY (page_id) REFERENCES pages(id),
        CONSTRAINT fk_editor_users FOREIGN KEY (user_id) REFERENCES users(id),
        PRIMARY KEY (page_id, user_id)
      );`)
    } else if (isMysql) {
      await db.query(sql`CREATE TABLE pages (
        id INTEGER PRIMARY KEY AUTO_INCREMENT,
        the_title VARCHAR(255) NOT NULL
      );`)

      await db.query(sql`CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTO_INCREMENT,
        username VARCHAR(255) NOT NULL
      );`)

      await db.query(sql`CREATE TABLE editors (
        page_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        role VARCHAR(255) NOT NULL,
        CONSTRAINT \`fk_editor_pages\` FOREIGN KEY (page_id) REFERENCES pages (id) ON DELETE CASCADE ON UPDATE RESTRICT,
        CONSTRAINT \`fk_editor_users\` FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE RESTRICT,
        PRIMARY KEY (page_id, user_id)
      );`)
    }
  }
  const mapper = await connect({
    connectionString: connInfo.connectionString,
    log: fakeLogger,
    onDatabaseLoad,
    ignore: {},
    hooks: {}
  })
  const pageEntity = mapper.entities.page
  const userEntity = mapper.entities.user
  const editorEntity = mapper.entities.editor

  const page = await pageEntity.save({
    input: { theTitle: 'foobar' }
  })
  same(page, { id: '1', theTitle: 'foobar' })

  const user = await userEntity.save({
    input: { username: 'mcollina' }
  })
  same(user, { id: '1', username: 'mcollina' })

  const user2 = await userEntity.save({
    input: { username: 'lucamaraschi' }
  })
  same(user2, { id: '2', username: 'lucamaraschi' })

  const editor1 = await editorEntity.save({
    input: {
      pageId: '1',
      userId: '1',
      role: 'admin'
    }
  })
  same(editor1, { pageId: '1', userId: '1', role: 'admin' })

  const editor2 = await editorEntity.save({
    input: {
      pageId: '1',
      userId: '2',
      role: 'author'
    }
  })
  same(editor2, { pageId: '1', userId: '2', role: 'author' })

  await editorEntity.save({
    input: {
      pageId: '1',
      userId: '1',
      role: 'captain'
    }
  })

  const editors = await editorEntity.find({ orderBy: [{ field: 'userId', direction: 'ASC' }] })
  same(editors, [{
    pageId: '1',
    userId: '1',
    role: 'captain'
  }, {
    pageId: '1',
    userId: '2',
    role: 'author'
  }])

  await editorEntity.delete({})

  const editorsInserted = await editorEntity.insert({
    inputs: [{
      pageId: '1',
      userId: '1',
      role: 'admin'
    }, {
      pageId: '1',
      userId: '2',
      role: 'author'
    }]
  })
  same(editorsInserted, [{
    pageId: '1',
    userId: '1',
    role: 'admin'
  }, {
    pageId: '1',
    userId: '2',
    role: 'author'
  }])
})
