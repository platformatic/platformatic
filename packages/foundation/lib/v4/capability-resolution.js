import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, parse } from 'node:path'
import semver from 'semver'
import { CapabilityNotResolvableError } from './errors.js'

function readPackageJson (path) {
  try {
    return JSON.parse(readFileSync(path, 'utf-8'))
  } catch {
    return null
  }
}

// A package with an exports map need not expose ./package.json, so fall back to resolving the
// entry point and walking up to the manifest that names it.
function findPackageJson (require, module) {
  try {
    return require.resolve(`${module}/package.json`)
  } catch {
    // Fall through to the entry-point walk.
  }

  let directory = dirname(require.resolve(module))
  const filesystemRoot = parse(directory).root

  while (true) {
    const candidate = join(directory, 'package.json')

    if (readPackageJson(candidate)?.name === module) {
      return candidate
    }

    if (directory === filesystemRoot) {
      throw new Error(`Cannot locate the package.json of ${module}`)
    }

    directory = dirname(directory)
  }
}

/*
  The canonical capability resolution order: application-scoped first, with the runtime-bundled
  copy as the fallback. It inverts v3, whose worker tried a bare import resolved from
  @platformatic/basic — that is, from the runtime's own position — and only fell back to an
  application-scoped require when that threw.

  The order is not merely different, it is what makes the version-stamp check implementable at all:
  the stamp compares the factory's copy against the copy the worker will run, so a check resolving
  application-first against a worker resolving lexically would compare a copy nobody executes —
  reporting skew where there is none, and missing it where there is. The same order is applied by
  the worker's implementation import, this check, and the main process's schema import, so the
  three cannot disagree.
*/
export function resolveCapabilityPackage (module, applicationRoot) {
  const attempts = [
    { scope: 'application', require: createRequire(join(applicationRoot, 'noop.js')) },
    { scope: 'runtime', require: createRequire(import.meta.filename) }
  ]

  for (const { scope, require } of attempts) {
    try {
      const manifestPath = findPackageJson(require, module)
      const manifest = readPackageJson(manifestPath)

      if (manifest) {
        return { scope, path: dirname(manifestPath), version: manifest.version }
      }
    } catch {
      // Try the next scope. The error raised when both fail names the module and the root, which
      // is more useful than either resolution failure on its own.
    }
  }

  throw new CapabilityNotResolvableError(module, applicationRoot)
}

/*
  Major mismatch is a boot error; minor mismatch is a warning, since mid-upgrade drift is
  legitimate; patch differences are ignored.

  A prerelease component on either side demands exact identity: 4.0.0-alpha.1, 4.0.0-rc.2 and 4.0.0
  agree on major, minor and patch while differing in schema and factory shape, so the relaxed
  policy would pair incompatible halves precisely during the alpha and RC period, when they move
  fastest and users are explicitly expected to be on them.
*/
export function compareCapabilityVersions (stamped, resolved) {
  if (!stamped || !resolved) {
    // A hand-written { module } object carries no stamp and skips the check.
    return { level: 'ok', reason: 'unstamped' }
  }

  const left = semver.parse(stamped)
  const right = semver.parse(resolved)

  if (!left || !right) {
    return { level: 'ok', reason: 'unparseable' }
  }

  if (left.prerelease.length > 0 || right.prerelease.length > 0) {
    return stamped === resolved
      ? { level: 'ok', reason: 'prerelease-identical' }
      : { level: 'error', reason: 'prerelease-mismatch' }
  }

  if (left.major !== right.major) {
    return { level: 'error', reason: 'major-mismatch' }
  }

  if (left.minor !== right.minor) {
    return { level: 'warning', reason: 'minor-mismatch' }
  }

  return { level: 'ok', reason: 'compatible' }
}

/*
  The stamp closes the root/app skew hole: a root-inline factory resolves from the root's copy of
  the capability while the worker implementation may resolve a different one — with pnpm's strict
  layout those can be different versions, letting a 4.1-only option pass the editor and the factory
  only to be rejected by the 4.0 schema at boot, or silently misapplied where the schemas differ
  more subtly. Hoisted layouts, where factory and worker share one copy, never false-positive.
*/
export function checkCapabilityVersionSkew ({ id, module, stamped, applicationRoot }) {
  if (!stamped) {
    return null
  }

  const resolved = resolveCapabilityPackage(module, applicationRoot)
  const { level, reason } = compareCapabilityVersions(stamped, resolved.version)

  if (level === 'ok') {
    return null
  }

  return {
    level,
    reason,
    id,
    module,
    stamped,
    resolved: resolved.version,
    resolvedPath: resolved.path,
    scope: resolved.scope,
    message: `application '${id}' was configured by a ${module} factory stamped ${stamped}, but the copy the worker will load is ${resolved.version} at ${resolved.path}.`
  }
}
