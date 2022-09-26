import path from 'path'
import { rm, readFile, writeFile } from 'fs/promises'
import { cliPath } from './helper.mjs'
import { test } from 'tap'
import { fileURLToPath } from 'url'
import { execa } from 'execa'
import stripAnsi from 'strip-ansi'
import split from 'split2'

function urlDirname (url) {
  return path.dirname(fileURLToPath(url))
}

const pathToTSD = path.join(urlDirname(import.meta.url), '../../node_modules/.bin/tsd')

test('generate ts types', async (t) => {
  const cwd = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'gen-types')
  const configFile = await readFile(path.join(cwd, 'platformatic.db.json'), 'utf8')

  t.teardown(async () => {
    await Promise.all([
      writeFile(path.join(cwd, 'platformatic.db.json'), configFile),
      rm(path.join(cwd, 'types'), { recursive: true, force: true }),
      rm(path.join(cwd, 'global.d.ts'), { force: true }),
      rm(path.join(cwd, 'plugin.js'), { force: true })
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
  const configFile = await readFile(path.join(cwd, 'platformatic.db.json'), 'utf8')

  t.teardown(async () => {
    await Promise.all([
      writeFile(path.join(cwd, 'platformatic.db.json'), configFile),
      rm(path.join(cwd, 'types'), { recursive: true, force: true }),
      rm(path.join(cwd, 'global.d.ts'), { force: true }),
      rm(path.join(cwd, 'plugin.js'), { force: true })
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

test('should show warning if there is no entities', async (t) => {
  const cwd = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'auto-gen-types')

  t.teardown(async () => {
    await Promise.all([
      rm(path.join(cwd, 'types'), { recursive: true, force: true }),
      rm(path.join(cwd, 'global.d.ts'), { force: true }),
      rm(path.join(cwd, 'db'), { force: true })
    ])
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

test('generate types on start', async ({ plan, equal, teardown, fail, pass }) => {
  plan(2)

  const cwd = path.join(urlDirname(import.meta.url), '..', 'fixtures', 'auto-gen-types')

  teardown(async () => {
    await Promise.all([
      rm(path.join(cwd, 'types'), { recursive: true, force: true }),
      rm(path.join(cwd, 'global.d.ts'), { force: true }),
      rm(path.join(cwd, 'db'), { force: true })
    ])
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
