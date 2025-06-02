'use strict'

import { BaseGenerator } from '@platformatic/generators'
import { basename, dirname, sep } from 'node:path'

const indexFile = `
import { createServer } from 'node:http'

export function create() {
  return createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'application/json', connection: 'close' })
    res.end(JSON.stringify({ hello: 'world' }))
  })
}
`

export class Generator extends BaseGenerator {
  constructor (opts = {}) {
    super({
      ...opts,
      module: '@platformatic/node'
    })
  }

  async prepare () {
    if (this.config.isUpdating) {
      return
    }

    const main = this.config.main || 'index.js'
    let indexPath = ''
    let indexName = main

    if (main.indexOf(sep) !== -1) {
      indexPath = dirname(main)
      indexName = basename(main)
    }

    await this.getPlatformaticVersion()

    this.addFile({ path: indexPath, file: indexName, contents: indexFile.trim() + '\n' })

    this.addFile({
      path: '',
      file: 'package.json',
      contents: JSON.stringify(
        {
          name: `${this.config.serviceName}`,
          main,
          type: 'module',
          scripts: {
            start: 'start-platformatic-node'
          },
          dependencies: {
            '@platformatic/node': `^${this.platformaticVersion}`
          }
        },
        null,
        2
      )
    })

    this.addFile({
      path: '',
      file: 'watt.json',
      contents: JSON.stringify(
        {
          $schema: `https://schemas.platformatic.dev/@platformatic/node/${this.platformaticVersion}.json`
        },
        null,
        2
      )
    })

    return {
      targetDirectory: this.targetDirectory,
      env: this.config.env
    }
  }

  async _getConfigFileContents () {}
}
