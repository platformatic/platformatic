'use strict'

const split = require('split2')
const { setTimeout: sleep } = require('node:timers/promises')
const { Unpromise } = require('@watchable/unpromise')
let execa
let parseCommandString

async function executeCommand(cwd, command, logger, errorPrefix) {
  if (!execa) {
    const { execa: _execa, parseCommandString: _parseCommandString } = await import('execa')
    execa = _execa
    parseCommandString = _parseCommandString
  }

  // Execute
  const [executable, ...args] = typeof command === 'string' ? parseCommandString(command) : command
  const subprocess = execa(executable, args, { reject: false, preferLocal: true, ipc: true, cwd, all: true })

  // Log during execution if in the debug mode
  if (logger) {
    for await (const line of subprocess.all.pipe(split())) {
      logger.debug(`  ${line}`)
    }
  }

  // Get the result
  const result = await subprocess
  const { failed, exitCode, all: output } = result

  // Spawn error
  if (failed && typeof exitCode !== 'number') {
    throw result
  }

  // Log the output in case of errors
  if (exitCode !== 0 && logger) {
    if (logger.isLevelEnabled('debug')) {
      logger.error(`${errorPrefix.replace('{EXIT_CODE}', exitCode)}.`)
    } else {
      logger.error(`${errorPrefix.replace('{EXIT_CODE}', exitCode)}:`)

      for (const line of output.split('\n')) {
        logger.error(`  ${line}`)
      }
    }
  }

  return { exitCode, output }
}

async function executeWithTimeout(promise, timeout, timeoutValue = 'timeout') {
  const ac = new AbortController()

  return Unpromise.race([promise, sleep(timeout, timeoutValue, { signal: ac.signal, ref: false })]).then(value => {
    ac.abort()
    return value
  })
}

module.exports = { executeCommand, executeWithTimeout }
