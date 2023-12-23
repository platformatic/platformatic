const { test } = require('node:test')
const { equal, deepEqual, ok } = require('node:assert')
const { setupDatabase, isSQLite } = require('./helper')

const seed = [
  'DROP TABLE IF EXISTS movies',
  isSQLite
    ? `CREATE TABLE movies (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    title VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`
    : `CREATE TABLE movies (
    id SERIAL NOT NULL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  'INSERT INTO movies (title) VALUES (\'Jurassic Park\'), (\'The Dark Knight\'), (\'Memento\')'
]

test('setup', async t => {
  await t.test('should setup cache with default settings', async t => {
    const mapper = await setupDatabase({ seed, cache: true, t })

    ok(typeof mapper.cache.MovieFind === 'function')
  })
})

test('dedupe', async t => {
  await t.test('should dedupe find method', async t => {
    let dedupes = 0
    let hits = 0
    let misses = 0
    let errors = 0
    const cache = {
      onDedupe: () => { dedupes++ },
      onHit: () => { hits++ },
      onMiss: () => { misses++ },
      onError: () => { errors++ }
    }
    const mapper = await setupDatabase({ seed, cache, t })
    const concurrency = 10

    const tasks = new Array(concurrency).fill().map(_ => mapper.entities.movie.find({ fields: ['title'] }))
    const results = await Promise.allSettled(tasks)

    equal(results.length, concurrency)
    results.forEach(r => deepEqual(r.value, [{ title: 'Jurassic Park' }, { title: 'The Dark Knight' }, { title: 'Memento' }]))
    equal(dedupes, concurrency - 1)
    equal(hits, 0)
    equal(misses, 0)
    equal(errors, 0)
  })

  await t.test('should not dedupe find method under transaction', async t => {
    let dedupes = 0
    let hits = 0
    let misses = 0
    let errors = 0
    const cache = {
      onDedupe: () => { dedupes++ },
      onHit: () => { hits++ },
      onMiss: () => { misses++ },
      onError: () => { errors++ }
    }
    const mapper = await setupDatabase({ seed, cache, t })
    const concurrency = 10

    await mapper.db.tx(async tx => {
      const tasks = new Array(concurrency).fill().map(_ => mapper.entities.movie.find({ fields: ['title'], tx }))
      const results = await Promise.allSettled(tasks)

      equal(results.length, concurrency)
      results.forEach(r => deepEqual(r.value, [{ title: 'Jurassic Park' }, { title: 'The Dark Knight' }, { title: 'Memento' }]))
    })

    equal(dedupes, 0)
    equal(hits, 0)
    equal(misses, 0)
    equal(errors, 0)
  })
})
