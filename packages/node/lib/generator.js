'use strict'

import { BaseGenerator } from '@platformatic/generators'

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

    await this.getPlatformaticVersion()

    this.addFile({ path: '', file: 'index.js', contents: indexFile.trim() + '\n' })

    this.addFile({
      path: '',
      file: 'package.json',
      contents: JSON.stringify(
        {
          name: `${this.config.serviceName}`,
          main: 'index.js',
          scripts: {
            start: 'node index.js'
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
