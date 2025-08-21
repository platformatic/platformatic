import { importOrLocal } from './import-or-local.js'

// These are already set automatically by the runtime, so we throw
// if set again.
const defaultInstrumentations = ['@opentelemetry/instrumentation-http', '@opentelemetry/instrumentation-undici']

async function getInstrumentationInstance (instrumentationConfig, applicationDir) {
  if (typeof instrumentationConfig === 'string') {
    instrumentationConfig = { package: instrumentationConfig, exportName: 'default', options: {} }
  }
  const { package: packageName, exportName = 'default', options = {} } = instrumentationConfig

  if (defaultInstrumentations.includes(packageName)) {
    throw new Error(
      `Instrumentation package ${packageName} is already included by default, please remove it from your config.`
    )
  }

  let mod
  try {
    mod = await importOrLocal({ pkg: packageName, projectDir: applicationDir })
  } catch (err) {
    throw new Error(
      `Instrumentation package not found: ${instrumentationConfig.package}, please add it to your dependencies.`
    )
  }

  let Instrumenter = mod[exportName]
  if (!Instrumenter || typeof Instrumenter !== 'function') {
    // Check for for an export that ends with 'Instrumentation'. We need to do that because unfortunately
    // each instrumenttions has different named export. But all of them ends with 'Instrumentation'.
    const possibleExports = Object.keys(mod).filter(key => key.endsWith('Instrumentation'))
    if (possibleExports.length === 0) {
      throw new Error(`Instrumentation export not found: ${exportName} in ${packageName}. Please specify in config`)
    }
    if (possibleExports.length > 1) {
      throw new Error(
        `Multiple Instrumentation exports found: ${possibleExports} in ${packageName}. Please specify in config`
      )
    }
    Instrumenter = mod[possibleExports[0]]
  }
  const instance = new Instrumenter(options)
  return instance
}

// Example of instrumentations config:
// "instrumentations": [
//       "@opentelemetry/instrumentation-express",
//       {
//          "package": "@opentelemetry/instrumentation-redisjs",
//          "exportName": "RedisInstrumentation",
//          "options": { "foo": "bar" }
//       }
export async function getInstrumentations (configs = [], applicationDir) {
  const instrumentations = []
  for (const instrumentationConfig of configs) {
    const instance = await getInstrumentationInstance(instrumentationConfig, applicationDir)
    instrumentations.push(instance)
  }
  return instrumentations
}
