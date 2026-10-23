import {
  AlwaysOffSampler,
  AlwaysOnSampler,
  ParentBasedSampler,
  TraceIdRatioBasedSampler
} from '@opentelemetry/sdk-trace-base'
import { isAbsolute, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

/**
 * Builds the sampler from configuration, in the two shapes the rest of the
 * configuration already uses: a `type` out of a known set, like `exporter`, or a
 * `package` pointing at a module, like `instrumentations`.
 *
 * The type names are the ones the OpenTelemetry specification defines for
 * OTEL_TRACES_SAMPLER, so they map one to one onto what people already know.
 */
const BY_TYPE = {
  always_on: () => new AlwaysOnSampler(),
  always_off: () => new AlwaysOffSampler(),
  traceidratio: ({ ratio = 1 }) => new TraceIdRatioBasedSampler(ratio),
  parentbased_always_on: () => new ParentBasedSampler({ root: new AlwaysOnSampler() }),
  parentbased_always_off: () => new ParentBasedSampler({ root: new AlwaysOffSampler() }),
  parentbased_traceidratio: ({ ratio = 1 }) =>
    new ParentBasedSampler({ root: new TraceIdRatioBasedSampler(ratio) })
}

export const SAMPLER_TYPES = Object.keys(BY_TYPE)

/**
 * A relative or absolute path is resolved against the application directory and
 * imported as a file; anything else is imported as a package name. Done here
 * rather than through importOrLocal because that helper's fallback sits behind a
 * synchronous try around an unawaited import(), so it never runs for a specifier
 * that fails to resolve — and a mistyped path would surface as a confusing error
 * instead of Node's own.
 */
async function loadSamplerModule (packageName, applicationDir) {
  const specifier =
    packageName.startsWith('.') || isAbsolute(packageName)
      ? pathToFileURL(resolve(applicationDir ?? process.cwd(), packageName)).href
      : packageName

  return import(specifier)
}

/**
 * Returns the configured sampler, or undefined when there is no sampler
 * configured — the provider then keeps its own default of recording everything.
 */
export async function getSampler (opts) {
  const { sampler, applicationDir } = opts ?? {}

  if (!sampler) {
    return undefined
  }

  if (sampler.package) {
    const { package: packageName, exportName = 'default', options = {} } = sampler
    const mod = await loadSamplerModule(packageName, applicationDir)
    const exported = mod[exportName]

    if (!exported) {
      throw new Error(`Sampler module ${packageName} has no export "${exportName}".`)
    }

    // A function is a factory receiving the configured options, the same
    // contract proxy.custom uses; anything else is taken as the sampler itself.
    const instance = typeof exported === 'function' ? await exported(options) : exported

    if (typeof instance?.shouldSample !== 'function') {
      throw new Error(`Sampler module ${packageName} did not return a sampler with a shouldSample method.`)
    }

    return instance
  }

  const build = BY_TYPE[sampler.type]

  // Deliberately not falling back to recording everything: a mistyped sampler
  // would then silently trace the whole load it was meant to reduce.
  if (!build) {
    throw new Error(
      `Unknown sampler type: ${sampler.type}. Supported types are ${SAMPLER_TYPES.join(', ')}, or a "package" pointing at a module.`
    )
  }

  return build(sampler.options ?? {})
}
