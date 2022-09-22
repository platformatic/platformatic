import { cliPath } from './helper.mjs'
import { test } from 'tap'
import { join } from 'desm'
import { execa } from 'execa'
import { rm } from 'fs/promises'

const dbLocation = join(import.meta.url, '..', 'fixtures', 'sqlite', 'db')

test('print the graphql schema to stdout', async ({ matchSnapshot }) => {
  try {
    await rm(dbLocation)
  } catch {
    // ignore
  }

  const { stdout } = await execa('node', [cliPath, 'schema', 'graphql'], {
    cwd: join(import.meta.url, '..', 'fixtures', 'sqlite')
  })

  matchSnapshot(stdout)
})

test('print the openapi schema to stdout', async ({ matchSnapshot }) => {
  try {
    await rm(dbLocation)
  } catch {
    // ignore
  }

  const { stdout } = await execa('node', [cliPath, 'schema', 'openapi'], {
    cwd: join(import.meta.url, '..', 'fixtures', 'sqlite')
  })

  matchSnapshot(stdout)
})
