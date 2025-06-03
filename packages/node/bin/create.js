#!/usr/bin/env node

import { basename, join } from 'node:path'
import { parseArgs } from 'node:util'
import { Generator } from '../lib/generator.js'

async function execute () {
  const args = parseArgs({
    args: process.argv.slice(2),
    options: {
      dir: {
        type: 'string',
        default: join(process.cwd(), 'plt-node')
      },
      main: { type: 'string', default: 'index.js' }
    }
  })

  const generator = new Generator()

  generator.setConfig({
    targetDirectory: args.values.dir,
    serviceName: basename(args.values.dir),
    main: args.values.main
  })

  await generator.run()

  console.log('Application created successfully! Run `npm run start` to start an application.')
}

execute()
