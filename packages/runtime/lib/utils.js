'use strict'

const { createHash } = require('node:crypto')
const { tmpdir } = require('node:os')
const { join } = require('node:path')

const {
  Store,
  loadConfig: pltConfigLoadConfig,
  loadEmptyConfig: pltConfigLoadEmptyConfig
} = require('@platformatic/config')

const { platformaticRuntime } = require('./config')

function getArrayDifference (a, b) {
  return a.filter(element => {
    return !b.includes(element)
  })
}

function getServiceUrl (id) {
  return `http://${id}.plt.local`
}

function getRuntimeTmpDir (runtimeDir) {
  const platformaticTmpDir = join(tmpdir(), 'platformatic', 'applications')
  const runtimeDirHash = createHash('md5').update(runtimeDir).digest('hex')
  return join(platformaticTmpDir, runtimeDirHash)
}

function getRuntimeLogsDir (runtimeDir, runtimePID) {
  const runtimeTmpDir = getRuntimeTmpDir(runtimeDir)
  return join(runtimeTmpDir, runtimePID.toString(), 'logs')
}

async function loadConfig (minimistConfig, args, overrides, replaceEnv = true) {
  const { default: platformaticBasic } = await import('@platformatic/basic')
  const store = new Store()
  store.add(platformaticRuntime)

  const id = platformaticRuntime.schema.$id.replace('@platformatic/runtime', 'wattpm')
  const schema = {
    ...platformaticRuntime.schema,
    $id: id
  }
  const configManagerConfig = {
    ...platformaticRuntime.configManagerConfig,
    schema
  }
  const wattpm = {
    ...platformaticRuntime,
    schema,
    configManagerConfig
  }
  store.add(wattpm)
  store.add(platformaticBasic)

  return pltConfigLoadConfig(minimistConfig, args, store, overrides, replaceEnv)
}

async function loadEmptyConfig (path, overrides, replaceEnv = true) {
  const { default: platformaticBasic } = await import('@platformatic/basic')

  return pltConfigLoadEmptyConfig(path, platformaticBasic, overrides, replaceEnv)
}

module.exports = {
  getArrayDifference,
  getRuntimeLogsDir,
  getRuntimeTmpDir,
  getServiceUrl,
  loadConfig,
  loadEmptyConfig
}
