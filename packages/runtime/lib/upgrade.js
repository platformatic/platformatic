'use strict'

const { join } = require('path')
const pkg = require('../package.json')

module.exports = async function upgrade (config, version) {
  const { semgrator } = await import('semgrator')

  const iterator = semgrator({
    version,
    path: join(__dirname, 'versions'),
    input: config,
    logger: this.logger.child({ name: '@platformatic/runtime' })
  })

  let result

  for await (const updated of iterator) {
    result = updated.result
  }

  result.$schema = `https://platformatic.dev/schemas/v${pkg.version}/runtime`

  return result
}
