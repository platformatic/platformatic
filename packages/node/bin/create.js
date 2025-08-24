#!/usr/bin/env node

import { basename, join } from 'node:path'
import { parseArgs } from 'node:util'
import { Generator } from '../lib/generator.js'

function parseBoolean (value) {
  if (value === undefined) {
    return false
  }

  if (value === 'true') {
    return true
  } else if (value === 'false') {
    return false
  }

  throw new Error(`Invalid boolean value: ${value}`)
}

async function execute () {
  const args = parseArgs({
    args: process.argv.slice(2),
    options: {
      dir: {
        type: 'string',
        default: join(process.cwd(), 'plt-node')
      },
      port: { type: 'string', default: '3042' },
      hostname: { type: 'string', default: '0.0.0.0' },
      main: { type: 'string', default: 'index.js' },
      plugin: { type: 'string', default: 'true' },
      tests: { type: 'string', default: 'true' },
      typescript: { type: 'boolean', default: false },
      git: { type: 'boolean', default: false },
      localSchema: { type: 'string', default: 'true' },
      help: { type: 'boolean', default: false }
    }
  })

  if (args.values.help) {
    console.log(`
Usage: create [options]

Options:
  --dir <directory>       Target directory (default: plt-node)
  --port <port>          Port number (default: 3042)
  --hostname <hostname>   Hostname (default: 0.0.0.0)
  --main <file>          Main entry file (default: index.js)
  --plugin <true|false>   Enable plugin support (default: true)
  --tests <true|false>    Generate tests (default: true)
  --typescript           Enable TypeScript (default: false)
  --git                  Initialize git repository (default: false)
  --localSchema <true|false>  Use local schema (default: true)
  --help                 Show this help message
    `)
    return
  }

  const generator = new Generator()

  const config = {
    port: parseInt(args.values.port),
    hostname: args.values.hostname,
    targetDirectory: args.values.dir,
    serviceName: basename(args.values.dir),
    main: args.values.main,
    plugin: parseBoolean(args.values.plugin),
    tests: parseBoolean(args.values.tests),
    typescript: args.values.typescript,
    initGitRepository: args.values.git,
    localSchema: parseBoolean(args.values.localSchema)
  }

  generator.setConfig(config)

  await generator.run()

  console.log('Application created successfully! Run `npm run start` to start an application.')
}

execute().catch(err => {
  console.error(err)
  process.exit(1)
})

// Signed-off-by: tawseefnabi <tawseefnabi9@gmail.com>
