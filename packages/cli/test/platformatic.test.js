import { test } from 'tap'
import { join } from 'desm'
import { readFile } from 'fs/promises'
import { execa } from 'execa'
import { cliPath } from './helper.js'
import { EOL } from 'os'

const version = JSON.parse(await readFile(join(import.meta.url, '..', 'package.json'))).version
const help = await readFile(join(import.meta.url, '..', 'help', 'help.txt'), 'utf8')

// This reads a file from packages/db
const helpDB = await readFile(join(import.meta.url, '..', '..', 'db', 'help', 'help.txt'), 'utf8')

test('version', async (t) => {
  const { stdout } = await execa('node', [cliPath, '--version'])
  t.ok(stdout.includes('v' + version))
})

test('db', async (t) => {
  try {
    await execa('node', [cliPath, 'db'])
    t.fail('bug')
  } catch (err) {
    t.ok(err.stderr.includes('Missing config file'))
  }
})

test('login', async (t) => {
  try {
    await execa('node', [cliPath, 'login'])
    t.fail('bug')
  } catch (err) {
    t.ok(err.stderr.includes('Unable to authenticate:'))
  }
})

test('command not found', async (t) => {
  try {
    await execa('node', [cliPath, 'foo'])
    t.fail('bug')
  } catch (err) {
    t.ok(err.stdout.includes('Command not found: foo'))
  }
})

test('prints the help with help command', async (t) => {
  const { stdout } = await execa('node', [cliPath, 'help'])
  t.equal(stdout + EOL, help)
})

test('prints the help with help flag', async (t) => {
  const { stdout } = await execa('node', [cliPath, '--help'])
  t.equal(stdout + EOL, help)
})

test('prints the help of db', async (t) => {
  const { stdout } = await execa('node', [cliPath, 'help', 'db'])
  t.equal(stdout + EOL, helpDB)
})

test('prints the help if not commands are specified', async (t) => {
  const { stdout } = await execa('node', [cliPath])
  t.equal(stdout + EOL, help)
})
