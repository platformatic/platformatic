#!/usr/bin/env node
import { checkNodeVersionForServices } from '@platformatic/utils'
import { join } from 'desm'
import isMain from 'es-main'
import { readFile } from 'fs/promises'
import parseArgs from 'minimist'
import { createPlatformatic } from './src/index.mjs'

if (isMain(import.meta)) {
  checkNodeVersionForServices()

  const _args = process.argv.slice(2)
  const args = parseArgs(_args, {
    alias: {
      v: 'version'
    }
  })

  if (args.version) {
    console.log('v' + JSON.parse(await readFile(join(import.meta.url, 'package.json'), 'utf8')).version)
    process.exit(0)
  }
  await createPlatformatic(_args)
}

export * from './src/index.mjs'
export * from './src/utils.mjs'
