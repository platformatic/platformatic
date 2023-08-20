import { test } from 'tap'
import { join } from 'desm'
import { readFile } from 'fs/promises'
import { execa } from 'execa'
import { cliPath } from './helper.js'
import { EOL } from 'os'
import { Agent, setGlobalDispatcher, request } from 'undici'
import split from 'split2'
import { on } from 'events'

setGlobalDispatcher(new Agent({
  keepAliveTimeout: 10,
  keepAliveMaxTimeout: 10,
  tls: {
    rejectUnauthorized: false
  }
}))

const version = JSON.parse(await readFile(join(import.meta.url, '..', 'package.json'))).version
const help = await readFile(join(import.meta.url, '..', 'help', 'help.txt'), 'utf8')

// This reads a file from packages/db
const helpDB = await readFile(join(import.meta.url, '..', '..', 'db', 'help', 'help.txt'), 'utf8')

// This reads a file from packages/runtime
const helpRuntime = await readFile(join(import.meta.url, '..', '..', 'runtime', 'help', 'help.txt'), 'utf8')

// This reads a file from packages/service
const helpService = await readFile(join(import.meta.url, '..', '..', 'service', 'help', 'help.txt'), 'utf8')

test('version', async (t) => {
  const { stdout } = await execa('node', [cliPath, '--version'])
  t.ok(stdout.includes('v' + version))
})

test('db', async (t) => {
  try {
    await execa('node', [cliPath, 'db', 'start'])
    t.fail('bug')
  } catch (err) {
    t.ok(err.stderr.includes('Missing config file'))
  }
})

test('runtime', async (t) => {
  try {
    await execa('node', [cliPath, 'runtime', 'start'])
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

test('subcommand not found', async (t) => {
  try {
    await execa('node', [cliPath, 'db', 'subfoo'])
    t.fail('bug')
  } catch (err) {
    t.ok(err.stdout.includes('Command not found: subfoo'))
  }
})

test('allows for minor typos in commands', async (t) => {
  try {
    await execa('node', [cliPath, 'dbx', 'start'])
    t.fail('bug')
  } catch (err) {
    t.ok(err.stderr.includes('Missing config file'))
  }
})

test('prints the help if command requires a subcommand', async (t) => {
  try {
    await execa('node', [cliPath, 'db'])
    t.fail('bug')
  } catch (err) {
    t.equal(err.stdout + EOL, helpDB)
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

test('prints the help of runtime', async (t) => {
  const { stdout } = await execa('node', [cliPath, 'help', 'runtime'])
  t.equal(stdout + EOL, helpRuntime)
})

test('prints the help of service', async (t) => {
  const { stdout } = await execa('node', [cliPath, 'help', 'service'])
  t.equal(stdout + EOL, helpService)
})

async function start (...args) {
  const { execa } = await import('execa')
  const child = execa('node', [cliPath, ...args])
  child.stderr.pipe(process.stdout)
  const output = child.stdout.pipe(split(function (line) {
    try {
      const obj = JSON.parse(line)
      return obj
    } catch (err) {
      console.log(line)
    }
  }))
  child.ndj = output

  const errorTimeout = setTimeout(() => {
    throw new Error('Couldn\'t start server')
  }, 10000)

  for await (const messages of on(output, 'data')) {
    for (const message of messages) {
      const text = message.msg
      if (text && text.includes('Server listening at')) {
        const url = text.match(/Server listening at (.*)/)[1]
        clearTimeout(errorTimeout)
        return { child, url, output }
      }
    }
  }
}

test('start the database and do a call', async ({ teardown, equal, match }) => {
  const config = join(import.meta.url, '..', 'fixtures/sqlite/platformatic.db.json')
  const { child, url } = await start('db', 'start', '-c', config)
  teardown(() => {
    child.kill('SIGINT')
  })

  const res = await request(`${url}/graphql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `
            mutation {
              saveGraph(input: { name: "Hello" }) {
                id
                name
              }
            }
          `
    })
  })
  equal(res.statusCode, 200, 'saveGraph status code')
  const body = await res.body.json()
  match(body, {
    data: {
      saveGraph: {
        name: 'Hello'
      }
    }
  }, 'saveGraph response')
})
