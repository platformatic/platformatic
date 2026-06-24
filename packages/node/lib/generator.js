'use strict'

import { BaseGenerator } from '@platformatic/generators'
import { basename, dirname, sep } from 'node:path'

const indexFileJS = `
import { getLogger } from '@platformatic/globals'
import { createServer } from 'node:http'

export function create() {
  const logger = getLogger()
  
  return createServer((_, res) => {
    logger.debug('Serving request.')
    res.writeHead(200, { 'content-type': 'application/json', connection: 'close' })
    res.end(JSON.stringify({ hello: 'world' }))
  })
}
`

const indexFileTS = `
import { getLogger } from '@platformatic/globals'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'

export function create() {
  const logger = getLogger()
  
  return createServer((_: IncomingMessage, res: ServerResponse) => {
    logger.debug('Serving request.')
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

  async prepareQuestions () {
    await super.prepareQuestions()

    if (!this.config.skipTypescript) {
      this.questions.push({
        type: 'select',
        name: 'typescript',
        message: 'Do you want to use TypeScript?',
        default: false,
        choices: [
          { name: 'yes', value: true },
          { name: 'no', value: false }
        ]
      })
    }
  }

  async prepare () {
    await this.getPlatformaticVersion()

    if (this.config.isUpdating) {
      return
    }

    const main = this.config.main || (this.config.typescript ? 'index.ts' : 'index.js')
    let indexPath = ''
    let indexName = main

    if (main.indexOf(sep) !== -1) {
      indexPath = dirname(main)
      indexName = basename(main)
    }

    let indexTemplate = indexFileJS
    const dependencies = {
      '@platformatic/globals': `^${this.platformaticVersion}`,
      '@platformatic/node': `^${this.platformaticVersion}`
    }

    const devDependencies = {}

    if (this.config.typescript) {
      indexTemplate = indexFileTS

      devDependencies['@platformatic/tsconfig'] = '^0.1.0'
      devDependencies['@types/node'] = '^22.0.0'
    }

    this.addFile({ path: indexPath, file: indexName, contents: indexTemplate.trim() + '\n' })

    this.addFile({
      path: '',
      file: 'package.json',
      contents: JSON.stringify(
        {
          name: `${this.config.applicationName}`,
          version: '0.1.0',
          main,
          type: 'module',
          dependencies,
          devDependencies
        },
        null,
        2
      )
    })

    if (this.config.typescript) {
      this.addFile({
        path: '',
        file: 'tsconfig.json',
        contents: JSON.stringify({ extends: '@platformatic/tsconfig' }, null, 2)
      })
    }

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
