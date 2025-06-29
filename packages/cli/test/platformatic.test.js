import { join } from 'desm'
import { execa } from 'execa'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { EOL, tmpdir } from 'node:os'
import { test } from 'node:test'
import { Agent, setGlobalDispatcher } from 'undici'
import { cliPath } from './helper.js'

setGlobalDispatcher(
  new Agent({
    keepAliveTimeout: 10,
    keepAliveMaxTimeout: 10,
    tls: {
      rejectUnauthorized: false
    }
  })
)

const version = JSON.parse(await readFile(join(import.meta.url, '..', 'package.json'), 'utf-8')).version
const help = await readFile(join(import.meta.url, '..', 'help', 'help.txt'), 'utf8')

// This reads a file from packages/db
const helpDB = await readFile(join(import.meta.url, '..', '..', 'db', 'bin', 'help', 'help.txt'), 'utf8')

// This reads a file from packages/runtime
const helpRuntime = await readFile(join(import.meta.url, '..', '..', 'runtime', 'bin', 'help', 'help.txt'), 'utf8')

// This reads a file from packages/service
const helpService = await readFile(join(import.meta.url, '..', '..', 'service', 'bin', 'help', 'help.txt'), 'utf8')

const localTmp = tmpdir()

function matchOutput (actual, expected) {
  assert.equal(actual.replaceAll(EOL, '\n').trim(), expected.replaceAll(EOL, '\n').trim())
}

test('version', async t => {
  const { stdout } = await execa('node', [cliPath, '--version'])
  assert.ok(stdout.includes('v' + version))
})

test('command not found', async t => {
  try {
    await execa('node', [cliPath, 'foo'])
    assert.fail('bug')
  } catch (err) {
    assert.ok(err.stdout.includes('Command not found: foo'))
  }
})

test('subcommand not found', async t => {
  try {
    await execa('node', [cliPath, 'db', 'subfoo'])
    assert.fail('bug')
  } catch (err) {
    assert.ok(err.stdout.includes('Command not found: subfoo'))
  }
})

test('prints the help if command requires a subcommand', async t => {
  try {
    await execa('node', [cliPath, 'db'])
    assert.fail('bug')
  } catch (err) {
    matchOutput(err.stdout, helpDB)
  }
})

test('prints the help with help command', async t => {
  const { stdout } = await execa('node', [cliPath, 'help'])
  matchOutput(stdout, help)
})

test('prints the help with help flag', async t => {
  const { stdout } = await execa('node', [cliPath, '--help'])
  matchOutput(stdout, help)
})

test('prints the help of db', async t => {
  const { stdout } = await execa('node', [cliPath, 'help', 'db'])
  matchOutput(stdout, helpDB)
})

test('prints the help if not commands are specified', async t => {
  const { stdout } = await execa('node', [cliPath])
  matchOutput(stdout, help)
})

test('prints the help of runtime', async t => {
  const { stdout } = await execa('node', [cliPath, 'help', 'runtime'])
  matchOutput(stdout, helpRuntime)
})

test('prints the help of service', async t => {
  const { stdout } = await execa('node', [cliPath, 'help', 'service'])
  matchOutput(stdout, helpService)
})

for (const type of ['service', 'db', 'composer']) {
  test('load dependency from folder', async t => {
    const cwd = process.cwd()
    process.chdir(localTmp)
    t.after(() => {
      process.chdir(cwd)
    })
    try {
      await execa('node', [cliPath, type, 'start'], {
        env: {
          ...process.env,
          NODE_PATH: ''
        }
      })
      assert.fail('bug')
    } catch (err) {
      assert.ok(err.stderr.includes('Cannot find module'))
    }
  })
}
