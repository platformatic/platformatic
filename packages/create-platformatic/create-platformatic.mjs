#!/usr/bin/env node
import createPlatformatic from './src/index.mjs'
import isMain from 'es-main'
import parseArgs from 'minimist'
import { readFile } from 'fs/promises'
import { join } from 'desm'

const currentVersion = process.versions.node
const requiredMajorVersion = parseInt(currentVersion.split('.')[0], 10)
const minimumMajorVersion = 16

if (requiredMajorVersion < minimumMajorVersion) {
  console.error(`Node.js v${currentVersion} is out of date and unsupported!`)
  console.error(`Please use Node.js v${minimumMajorVersion} or higher.`)
  process.exit(1)
}

if (isMain(import.meta)) {
  const _args = process.argv.slice(2)
  const args = parseArgs(_args, {
    alias: {
      v: 'version'
    }
  })

  if (args.version) {
    console.log('v' + JSON.parse(await readFile(join(import.meta.url, 'package.json'))).version)
    process.exit(0)
  }
  await createPlatformatic(_args)
}
