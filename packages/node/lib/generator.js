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

    /*
      The entrypoint's port lives in the env like every other scaffolded port: the config file reads
      it back as `Number(process.env.<PORT> || 3042)`, and .env carries the default so a reader sees
      what it resolves to. Registered before the config file is generated, because the placeholder
      resolution reads the env to learn the numeric fallback. Non-entrypoint applications write no
      port and stay reachable only on the mesh.
    */
    if (this.config.entrypoint) {
      this.addEnvVar('PORT', this.config.port, { overwrite: false, default: true })
    }

    /*
      Through the shared writer rather than by hand. This used to add its own `watt.json`, which was
      the same name the base class writes and so replaced it -- once that became a module they would
      have been two configurations in one directory, which the loader refuses.
    */
    await this.generateConfigFile()

    return {
      targetDirectory: this.targetDirectory,
      env: this.config.env
    }
  }

  /*
    A Node application declares which capability it is and lets the detector do the rest, so its
    configuration is empty -- except for the one thing the detector cannot infer. A Node capability
    binds an external port only when its configuration names one, so a sole application (the runtime's
    entrypoint) would otherwise start nothing reachable. When the runtime generator has marked this
    application the entrypoint, the port is written the same way every other capability writes it: a
    placeholder resolved against the scaffolded env var, so the file reads
    `Number(process.env.<PORT> || 3042)`. The empty object still gets a file otherwise, because
    owning one is how an application declares its scope.
  */
  async _getConfigFileContents () {
    if (!this.config.entrypoint) {
      return {}
    }

    return {
      server: {
        port: `{${this.getEnvVarName('PORT')}}`
      }
    }
  }
}
