import path from 'path'
import { rm, mkdir, cp } from 'fs/promises'
import { cliPath } from './helper.mjs'
import t from 'tap'
import { execa } from 'execa'
import stripAnsi from 'strip-ansi'
import split from 'split2'
import { urlDirname } from '../../lib/utils'

t.jobs = 6

const pathToTSD = path.join(urlDirname(import.meta.url), '../../node_modules/.bin/tsd')

t.test('generate ts types', async (t) => {
  const testDir = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'gen-types')
  const cwd = path.join(urlDirname(import.meta.url), '..', 'tmp', 'gen-types-clone-1')

  await mkdir(cwd)
  await cp(testDir, cwd, { recursive: true })

  t.teardown(async () => {
    await rm(cwd, { force: true, recursive: true })
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

t.test('generate ts types twice', async (t) => {
  const testDir = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'gen-types')
  const cwd = path.join(urlDirname(import.meta.url), '..', 'tmp', 'gen-types-clone-2')

  await mkdir(cwd)
  await cp(testDir, cwd, { recursive: true })

  t.teardown(async () => {
    await rm(cwd, { force: true, recursive: true })
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

t.test('should show warning if there is no entities', async (t) => {
  const testDir = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'auto-gen-types')
  const cwd = path.join(urlDirname(import.meta.url), '..', 'tmp', 'auto-gen-types-clone-1')

  await mkdir(cwd)
  await cp(testDir, cwd, { recursive: true })

  t.teardown(async () => {
    await rm(cwd, { force: true, recursive: true })
  })

  try {
    const { stdout } = await execa('node', [cliPath, 'types'], { cwd })
    t.match(stdout, /(.*)No entities found. Please run `platformatic db migrate` to generate entities./)
  } catch (err) {
    console.log(err.stdout)
    console.log(err.stderr)
    t.fail(err.stderr)
  }

  t.pass()
})

t.test('run migrate command with type generation', async (t) => {
  const testDir = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'auto-gen-types')
  const cwd = path.join(urlDirname(import.meta.url), '..', 'tmp', 'auto-gen-types-clone-2')

  await mkdir(cwd)
  await cp(testDir, cwd, { recursive: true })

  t.teardown(async () => {
    await rm(cwd, { force: true, recursive: true })
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

t.test('missing config file', async ({ equal, match }) => {
  try {
    await execa('node', [cliPath, 'seed'])
  } catch (err) {
    equal(err.exitCode, 1)
    match(err.stderr, 'Missing config file')
  }
})

t.test('generate types on start', async ({ plan, equal, teardown, fail, pass }) => {
  plan(2)

  const testDir = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'auto-gen-types')
  const cwd = path.join(urlDirname(import.meta.url), '..', 'tmp', 'auto-gen-types-clone-3')

  await mkdir(cwd)
  await cp(testDir, cwd, { recursive: true })

  teardown(async () => {
    await rm(cwd, { force: true, recursive: true })
  })

  const child = execa('node', [cliPath, 'start'], { cwd })
  teardown(() => child.kill('SIGINT'))

  const splitter = split()
  child.stdout.pipe(splitter)

  let found = false
  for await (const data of splitter) {
    const sanitized = stripAnsi(data)
    if (sanitized.match(/(.*)Generated type for(.*)/)) {
      found = true
      break
    }
  }
  equal(found, true)

  try {
    await execa(pathToTSD, { cwd })
  } catch (err) {
    console.log(err.stdout)
    console.log(err.stderr)
    fail(err.stderr)
  }

  pass()
})
