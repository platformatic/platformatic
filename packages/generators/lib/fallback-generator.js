'use strict'

const { BaseGenerator } = require('./base-generator')

class FallbackGenerator extends BaseGenerator {
  constructor (options = {}) {
    const { serviceName, module, version, ...opts } = options
    super({ ...opts, module })
    this.setConfig({ serviceName, module, version })
  }

  async prepare () {
    if (this.config.isUpdating) {
      return
    }

    const { module: pkg, version } = this.config

    if (this.config.module.startsWith('@platformatic/')) {
      this.addFile({
        path: '',
        file: 'watt.json',
        contents: JSON.stringify({ $schema: `https://schemas.platformatic.dev/${pkg}/${version}.json` }, null, 2)
      })
    } else {
      this.addFile({
        path: '',
        file: 'watt.json',
        contents: JSON.stringify({ module: pkg }, null, 2)
      })
    }

    this.addFile({
      path: '',
      file: 'package.json',
      contents: JSON.stringify({ name: `${this.config.serviceName}`, dependencies: { [pkg]: `^${version}` } }, null, 2)
    })

    return {
      targetDirectory: this.targetDirectory,
      env: this.config.env
    }
  }

  async _getConfigFileContents () {}
}

module.exports = { FallbackGenerator }
