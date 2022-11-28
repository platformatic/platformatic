#!/usr/bin/env node
import createPlatformaticDb from './src/index.mjs'

const currentVersion = process.versions.node
const requiredMajorVersion = parseInt(currentVersion.split('.')[0], 10)
const minimumMajorVersion = 16

if (requiredMajorVersion < minimumMajorVersion) {
  console.error(`Node.js v${currentVersion} is out of date and unsupported!`)
  console.error(`Please use Node.js v${minimumMajorVersion} or higher.`)
  process.exit(1)
}

await createPlatformaticDb()
