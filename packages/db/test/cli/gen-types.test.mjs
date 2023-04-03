import path from 'path'
import { rm, mkdir, cp } from 'fs/promises'
import { cliPath } from './helper.js'
import t from 'tap'
import { execa } from 'execa'
import stripAnsi from 'strip-ansi'
import split from 'split2'
import { urlDirname } from '../../lib/utils.js'
import { setTimeout as sleep } from 'timers/promises'

t.jobs = 1

let counter = 0

const pathToTSD = path.join(urlDirname(import.meta.url), '../../node_modules/.bin/tsd')

async function safeRm (dir) {
  let _err = null
  let count = 0

  while (count++ < 10) {
    try {
      _err = null
      await rm(dir, { force: true, recursive: true })
    } catch (err) {
      _err = err
      if (err.code === 'EBUSY') {
        await sleep(count * 100)
      } else {
        break
      }
    }
  }

  if (_err) {
    throw _err
  }
}

t.test('generate ts types', async (t) => {
  const testDir = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'gen-types')
  const cwd = path.join(urlDirname(import.meta.url), '..', 'tmp', `gen-types-clone-${counter++}`)

  try {
    await safeRm(cwd)
  } catch {}

  await mkdir(cwd)
  await cp(testDir, cwd, { recursive: true })

  t.teardown(async () => {
    await safeRm(cwd)
  })

  try {
    t.comment('running migrations')
    await execa('node', [cliPath, 'migrations', 'apply'], { cwd })
    t.comment('generating types')
    await execa('node', [cliPath, 'types'], { cwd })
    t.comment('running tsd')
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
  const cwd = path.join(urlDirname(import.meta.url), '..', 'tmp', `gen-types-clone-${counter++}`)

  try {
    await safeRm(cwd)
  } catch {}

  t.comment(cwd)
  await mkdir(cwd)
  await cp(testDir, cwd, { recursive: true })

  t.teardown(async () => {
    await safeRm(cwd)
  })

  try {
    t.comment('running migrations')
    await execa('node', [cliPath, 'migrations', 'apply'], { cwd })
    t.comment('first command')
    await execa('node', [cliPath, 'types'], { cwd })
    t.comment('second command')
    await execa('node', [cliPath, 'types'], { cwd })
    t.comment('running tsd')
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
  const cwd = path.join(urlDirname(import.meta.url), '..', 'tmp', `gen-types-clone-${counter++}`)

  try {
    await safeRm(cwd)
  } catch {}

  await cp(testDir, cwd, { recursive: true })

  t.teardown(async () => {
    await safeRm(cwd)
  })

  try {
    const { stdout } = await execa('node', [cliPath, 'types'], { cwd })
    t.match(stdout, /(.*)No table found. Please run `platformatic db migrations apply` to generate types./)
  } catch (err) {
    console.log(err.stdout)
    console.log(err.stderr)
    t.fail(err.stderr)
  }

  t.pass()
})

t.test('run migrate command with type generation', async (t) => {
  const testDir = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'auto-gen-types')
  const cwd = path.join(urlDirname(import.meta.url), '..', 'tmp', `gen-types-clone-${counter++}`)

  try {
    await safeRm(cwd)
  } catch {}

  await cp(testDir, cwd, { recursive: true })

  t.teardown(async () => {
    await safeRm(cwd)
  })

  try {
    const child = await execa('node', [cliPath, 'migrations', 'apply'], { cwd })
    t.equal(child.stdout.includes('Generated type for Graph entity.'), true)
    t.equal(child.stdout.includes('Please run `npm i --save'), true)

    await execa(pathToTSD, { cwd })
  } catch (err) {
    console.log(err.stdout)
    console.log(err.stderr)
    t.fail(err.stderr)
  }

  t.pass()
})

t.test('run migrate command with type generation without plugin in config', async (t) => {
  const testDir = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'auto-gen-types-no-plugin')
  const cwd = path.join(urlDirname(import.meta.url), '..', 'tmp', `gen-types-clone-${counter++}`)

  try {
    await safeRm(cwd)
  } catch {}

  await cp(testDir, cwd, { recursive: true })

  t.teardown(async () => {
    await safeRm(cwd)
  })

  try {
    const child = await execa('node', [cliPath, 'migrations', 'apply'], { cwd })
    t.equal(child.stdout.includes('Generated type for Graph entity.'), true)
    t.equal(child.stdout.includes('Please run `npm i --save'), true)

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
  const cwd = path.join(urlDirname(import.meta.url), '..', 'tmp', `gen-types-clone-${counter++}`)

  try {
    await safeRm(cwd)
  } catch {}

  await cp(testDir, cwd, { recursive: true })

  teardown(async () => {
    await safeRm(cwd)
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
    pass()
  } catch (err) {
    console.log(err.stdout)
    console.log(err.stderr)
    fail(err.stderr)
  }
})

t.test('correctly format entity type names', async (t) => {
  const testDir = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'chars-gen-types')
  const cwd = path.join(urlDirname(import.meta.url), '..', 'tmp', `gen-types-clone-${counter++}`)

  try {
    await safeRm(cwd)
  } catch {}
  await cp(testDir, cwd, { recursive: true })

  t.teardown(async () => {
    await safeRm(cwd)
  })

  try {
    const child = await execa('node', [cliPath, 'migrations', 'apply'], { cwd })
    t.equal(child.stdout.includes('Generated type for PltDb entity.'), true)
  } catch (err) {
    console.log(err.stdout)
    console.log(err.stderr)
    t.fail(err.stderr)
  }

  t.pass()
})

t.test('use types directory from config as target folder', async (t) => {
  const testDir = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'gen-types-dir')
  const cwd = path.join(urlDirname(import.meta.url), '..', 'tmp', `gen-types-clone-${counter++}`)

  try {
    await safeRm(cwd)
  } catch {}
  await cp(testDir, cwd, { recursive: true })

  t.teardown(async () => {
    await safeRm(cwd)
  })

  try {
    const child = await execa('node', [cliPath, 'migrations', 'apply'], { cwd })
    t.equal(child.stdout.includes('Generated type for Graph entity.'), true)

    await execa(pathToTSD, { cwd })
  } catch (err) {
    console.log(err.stdout)
    console.log(err.stderr)
    t.fail(err.stderr)
  }

  t.pass()
})

t.test('generate types on start while considering types directory', async ({ plan, equal, teardown, fail, pass }) => {
  plan(2)

  const testDir = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'auto-gen-types-dir')
  const cwd = path.join(urlDirname(import.meta.url), '..', 'tmp', `gen-types-clone-${counter++}`)

  try {
    await safeRm(cwd)
  } catch {}
  await cp(testDir, cwd, { recursive: true })

  teardown(async () => {
    await safeRm(cwd)
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
    pass()
  } catch (err) {
    console.log(err.stdout)
    console.log(err.stderr)
    fail(err.stderr)
  }
})
