'use strict'

import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { ConfigManager } from '@platformatic/config'

import { NextStackable } from './lib/next.js'
import { packageJson, schema } from './lib/schema.js'
import { ServerStackable } from './lib/server.js'
import { ViteStackable } from './lib/vite.js'

const validFields = [
  'main',
  'exports',
  'exports',
  'exports#node',
  'exports#import',
  'exports#require',
  'exports#default',
  'exports#.#node',
  'exports#.#import',
  'exports#.#require',
  'exports#.#default',
]

const validFilesBasenames = ['index', 'main', 'app', 'application', 'server', 'start', 'bundle', 'run', 'entrypoint']

async function parsePackageJson (root) {
  let entrypoint
  let packageJson
  let hadEntrypointField = false

  try {
    packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf-8'))
  } catch {
    // No package.json, we only load the index.js file
    packageJson = {}
  }

  for (const field of validFields) {
    let current = packageJson
    const sequence = field.split('#')

    while (current && sequence.length && typeof current !== 'string') {
      current = current[sequence.shift()]
    }

    if (typeof current === 'string') {
      entrypoint = current
      hadEntrypointField = true
      break
    }
  }

  if (!entrypoint) {
    for (const basename of validFilesBasenames) {
      for (const ext of ['js', 'mjs', 'cjs']) {
        const file = `${basename}.${ext}`

        if (existsSync(resolve(root, file))) {
          entrypoint = file
          break
        }
      }

      if (entrypoint) {
        break
      }
    }
  }

  return { packageJson, entrypoint, hadEntrypointField }
}

function transformConfig () {
  if (this.current.watch === undefined) {
    this.current.watch = { enabled: false }
  }

  if (typeof this.current.watch !== 'object') {
    this.current.watch = { enabled: this.current.watch || false }
  }
}

export async function buildStackable (opts) {
  const root = opts.context.directory
  const {
    entrypoint,
    hadEntrypointField,
    packageJson: { dependencies, devDependencies },
  } = await parsePackageJson(root)

  const configManager = new ConfigManager({ schema, source: opts.config ?? {} })
  await configManager.parseAndValidate()

  let stackable
  if (dependencies?.next || devDependencies?.next) {
    stackable = new NextStackable(opts, root, configManager)
  } else if (dependencies?.vite || devDependencies?.vite) {
    stackable = new ViteStackable(opts, root, configManager)
  } else {
    stackable = new ServerStackable(opts, root, configManager, entrypoint, hadEntrypointField)
  }

  return stackable
}

export default {
  configType: 'nodejs',
  configManagerConfig: {
    transformConfig,
  },
  buildStackable,
  schema,
  version: packageJson.version,
}
