#!/usr/bin/env node

import { checkNodeVersionForApplications } from '@platformatic/foundation'
import { createPlatformatic } from 'create-wattpm'
import parseArgs from 'minimist'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

checkNodeVersionForApplications()

const _args = process.argv.slice(2)
const args = parseArgs(_args, {
  alias: {
    v: 'version'
  }
})

if (args.version) {
  console.log('v' + JSON.parse(await readFile(join(import.meta.dirname, 'package.json'), 'utf8')).version)
  process.exit(0)
}

await createPlatformatic(_args)
