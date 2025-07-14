'use strict'

const { abstractLogger } = require('@platformatic/utils')
const { join } = require('node:path')
const { semgrator } = require('semgrator')

async function upgrade (logger, config, version) {
  const iterator = semgrator({
    version,
    path: join(__dirname, 'versions'),
    input: config,
    logger: logger?.child({ name: '@platformatic/runtime' }) ?? abstractLogger
  })

  let result

  for await (const updated of iterator) {
    result = updated.result
  }

  return result
}

module.exports = { upgrade }
