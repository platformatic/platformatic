import { createDirectory, safeRemove } from '@platformatic/foundation'
import assert from 'node:assert/strict'
import { cp, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { applyMigrations } from '../../lib/commands/migrations-apply.js'
import { createCapturingLogger, createTestContext, withWorkingDirectory } from './test-utilities.js'

let counter = 0

async function prepareTemporaryDirectory (t, testDir) {
  const cwd = resolve(import.meta.dirname, '..', 'tmp', `gen-types-schema-${counter++}`)

  t.after(async () => {
    await safeRemove(cwd)
  })

  await safeRemove(cwd)
  await createDirectory(cwd)
  await cp(testDir, cwd, { recursive: true })

  return cwd
}

test('generated types include JSON schema const exports', async t => {
  const testDir = resolve(import.meta.dirname, '..', 'fixtures', 'auto-gen-types')
  const cwd = await prepareTemporaryDirectory(t, testDir)
  const configFile = resolve(cwd, 'platformatic.db.json')

  const logger = createCapturingLogger()
  const context = createTestContext()

  await withWorkingDirectory(cwd, async () => {
    await applyMigrations(logger, configFile, [], context)
  })()

  // Read the generated Movie .d.ts file (interface only)
  const movieDTs = await readFile(resolve(cwd, 'types', 'movie.d.ts'), 'utf8')

  // Verify interface export exists
  assert.ok(movieDTs.includes('export interface Movie'), 'Should export Movie interface')

  // Verify no const in .d.ts (only interface)
  assert.ok(!movieDTs.includes('export const'), 'Should not have const exports in .d.ts')

  // Read the generated Movie schema file
  const movieSchema = await readFile(resolve(cwd, 'types', 'movie-schema.ts'), 'utf8')

  // Verify named const schema export exists
  assert.ok(movieSchema.includes('export const Movie'), 'Should export Movie schema as named const')
  assert.ok(movieSchema.includes('as const'), 'Should have as const assertion')

  // Extract and parse the JSON schema
  const schemaMatch = movieSchema.match(/export const Movie = ({[\s\S]*?}) as const/)
  assert.ok(schemaMatch, 'Should be able to extract schema')

  const schema = JSON.parse(schemaMatch[1])

  // Verify schema structure
  assert.equal(schema.$id, 'Movie', 'Schema $id should be Movie')
  assert.equal(schema.type, 'object', 'Schema type should be object')
  assert.equal(typeof schema.title, 'string', 'Schema should have a title')

  // Verify properties
  assert.ok(schema.properties, 'Schema should have properties object')
  assert.ok(schema.properties.id, 'Schema should have id property')
  assert.ok(schema.properties.title, 'Schema should have title property')
  assert.ok(schema.properties.boxOffice, 'Schema should have boxOffice property')
  assert.ok(schema.properties.year, 'Schema should have year property')

  // Verify property types
  assert.equal(schema.properties.id.type, 'integer', 'id type should be integer')
  assert.equal(schema.properties.title.type, 'string', 'title type should be string')
  assert.equal(schema.properties.year.type, 'integer', 'year type should be integer')

  // Verify required fields
  assert.ok(Array.isArray(schema.required), 'Schema should have required array')
  assert.ok(schema.required.includes('title'), 'title should be in required array')
  assert.ok(schema.required.includes('year'), 'year should be in required array')

  // Verify AggregateRating interface
  const aggregateRatingDTs = await readFile(resolve(cwd, 'types', 'aggregateRating.d.ts'), 'utf8')
  assert.ok(aggregateRatingDTs.includes('export interface AggregateRating'), 'Should export AggregateRating interface')
  assert.ok(!aggregateRatingDTs.includes('export const'), 'Should not have const exports in .d.ts')

  // Verify AggregateRating schema
  const aggregateRatingSchemaFile = await readFile(resolve(cwd, 'types', 'aggregateRating-schema.ts'), 'utf8')
  assert.ok(aggregateRatingSchemaFile.includes('export const AggregateRating'), 'Should export AggregateRating schema as named const')

  const aggregateRatingSchemaMatch = aggregateRatingSchemaFile.match(/export const AggregateRating = ({[\s\S]*?}) as const/)
  assert.ok(aggregateRatingSchemaMatch, 'Should be able to extract schema')

  const aggregateRatingSchema = JSON.parse(aggregateRatingSchemaMatch[1])
  assert.equal(aggregateRatingSchema.$id, 'AggregateRating', 'Schema $id should be AggregateRating')
  assert.equal(aggregateRatingSchema.type, 'object', 'Schema type should be object')
  assert.ok(aggregateRatingSchema.properties.movieId, 'Should have movieId property')
  assert.ok(aggregateRatingSchema.properties.rating, 'Should have rating property')
  assert.ok(aggregateRatingSchema.properties.ratingType, 'Should have ratingType property')
})

test('index file uses type-only imports without extensions', async t => {
  const testDir = resolve(import.meta.dirname, '..', 'fixtures', 'auto-gen-types')
  const cwd = await prepareTemporaryDirectory(t, testDir)
  const configFile = resolve(cwd, 'platformatic.db.json')

  const logger = createCapturingLogger()
  const context = createTestContext()

  await withWorkingDirectory(cwd, async () => {
    await applyMigrations(logger, configFile, [], context)
  })()

  const indexDTs = await readFile(resolve(cwd, 'types', 'index.d.ts'), 'utf8')

  // Verify type-only imports without extensions
  assert.ok(indexDTs.includes("import type { AggregateRating } from './aggregateRating'"),
    'Should have type-only import for AggregateRating without extension')
  assert.ok(indexDTs.includes("import type { Movie } from './movie'"),
    'Should have type-only import for Movie without extension')

  // Verify type-only exports without extensions
  assert.ok(indexDTs.includes("export type { AggregateRating } from './aggregateRating'"),
    'Should export type AggregateRating without extension')
  assert.ok(indexDTs.includes("export type { Movie } from './movie'"),
    'Should export type Movie without extension')

  // Verify framework imports use type-only syntax
  assert.ok(indexDTs.includes('import type { Entities as DatabaseEntities'),
    'Should have type-only import for DatabaseEntities')
  assert.ok(indexDTs.includes('import type { PlatformaticApplication }'),
    'Should have type-only import for PlatformaticApplication')
  assert.ok(indexDTs.includes('import type { FastifyInstance }'),
    'Should have type-only import for FastifyInstance')
})
