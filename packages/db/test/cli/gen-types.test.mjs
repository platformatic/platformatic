import path from 'path'
import { rm } from 'fs/promises'
import { cliPath } from './helper.mjs'
import { test } from 'tap'
import { fileURLToPath } from 'url'
import { execa } from 'execa'

function urlDirname (url) {
  return path.dirname(fileURLToPath(url))
}

const pathToTSD = path.join(urlDirname(import.meta.url), '../../node_modules/.bin/tsd')

test('generate ts types', async (t) => {
  const cwd = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'gen-types')

  t.teardown(async () => {
    await Promise.all([
      rm(path.join(cwd, 'types'), { recursive: true, force: true }),
      rm(path.join(cwd, 'global.d.ts'), { force: true })
    ])
  })

  try {
    await execa('node', [cliPath, 'types'], { cwd })
    await execa(pathToTSD, { cwd })
  } catch (err) {
    console.log(err.stdout)
    console.log(err.stderr)
    t.fail(err.stderr)
  }

  t.pass()
})

test('generate ts types twice', async (t) => {
  const cwd = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'gen-types')

  t.teardown(async () => {
    await Promise.all([
      rm(path.join(cwd, 'types'), { recursive: true, force: true }),
      rm(path.join(cwd, 'global.d.ts'), { force: true })
    ])
  })

  try {
    await execa('node', [cliPath, 'types'], { cwd })
    await execa('node', [cliPath, 'types'], { cwd })
    await execa(pathToTSD, { cwd })
  } catch (err) {
    console.log(err.stdout)
    console.log(err.stderr)
    t.fail(err.stderr)
  }

  t.pass()
})

test('run migrate command with type generation', async (t) => {
  const cwd = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'auto-gen-types')

  t.teardown(async () => {
    await Promise.all([
      rm(path.join(cwd, 'types'), { recursive: true, force: true }),
      rm(path.join(cwd, 'global.d.ts'), { force: true }),
      rm(path.join(cwd, 'db'), { force: true })
    ])
  })

  try {
    await execa('node', [cliPath, 'migrate'], { cwd })
    await execa(pathToTSD, { cwd })
  } catch (err) {
    console.log(err.stdout)
    console.log(err.stderr)
    t.fail(err.stderr)
  }

  t.pass()
})

test('missing config file', async ({ equal, match }) => {
  try {
    await execa('node', [cliPath, 'seed'])
  } catch (err) {
    equal(err.exitCode, 1)
    match(err.stderr, 'Missing config file')
  }
})
