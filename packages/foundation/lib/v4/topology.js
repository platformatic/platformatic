import { readdir, readFile } from 'node:fs/promises'
import { isAbsolute, join, resolve } from 'node:path'
import { deriveApplicationId } from './identifiers.js'

// The shorthand exists so a single app with runtime options never needs a one-element array.
// Declaring it alongside applications or autoload is an error: either combination would smuggle a
// multi-app runtime out of the single-app form.
export function normalizeApplications (config, { directory, onConflict }) {
  if (config.application !== undefined) {
    if (config.applications !== undefined || config.autoload !== undefined) {
      onConflict?.()
    }

    // The shorthand entry — and only it — defaults its path to the config file's own directory.
    // Defaulting every element of applications instead would give an explicit entry a path before
    // expansion could supply the autoloaded one, and the explicit-wins merge would then keep the
    // root directory for an application that lives under web/.
    config.application.path ??= directory
    config.applications = [config.application]
    delete config.application
  }

  config.applications ??= []

  return config
}

// One derivation used at every position means one reader for its middle rung as well: autoload
// expansion and the main-side driver both ask this, so they cannot drift.
export async function readPackageName (directory) {
  try {
    const contents = await readFile(join(directory, 'package.json'), 'utf-8')

    return JSON.parse(contents)?.name
  } catch {
    // On purpose: an application directory need not have a package.json, and the derivation falls
    // through to the directory name when it does not.
    return undefined
  }
}

/*
  Expansion is the only place autoload runs — the runtime transform consumes the already-expanded
  list. Orchestration drives filesystem access, which is why it is validated before it is acted on.

  The id follows the same derivation as everywhere else, where v3 used the directory name alone. A
  default that varied by boot style would move the mesh hostname, the injected variable name, the
  metrics label, wattpm inject's argument and the dependencies spelling all at once.
*/
export async function expandAutoload (config, { root }) {
  if (!config.autoload) {
    return config.applications
  }

  const { exclude = [], mappings = {} } = config.autoload
  const path = isAbsolute(config.autoload.path) ? config.autoload.path : resolve(root, config.autoload.path)
  const entries = await readdir(path, { withFileTypes: true })
  const applications = config.applications

  for (const entry of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
    if (!entry.isDirectory() || exclude.includes(entry.name)) {
      continue
    }

    const mapping = mappings[entry.name] ?? {}
    const directory = join(path, entry.name)
    const { id } = deriveApplicationId({
      id: mapping.id,
      packageName: await readPackageName(directory),
      directory
    })

    const expanded = { id, path: directory, ...mapping }
    const existing = applications.findIndex(application => application.id === id)

    if (existing !== -1) {
      // Shallow explicit-wins merge, v3 semantics. Assigning in place rather than reordering keeps
      // every explicit entry's position stable.
      applications[existing] = { ...expanded, ...applications[existing] }
    } else {
      applications.push(expanded)
    }
  }

  return applications
}

/*
  The projection resolve is owed, captured between expansion and the enabled filter — the only
  moment both lists exist. A remote entry excluded in the current mode is fetched all the same.

  It is a projection rather than the unfiltered entries because a disabled entry's deferred config
  slot is never called: an unfiltered list would put entries with an unfilled slot into the main
  process, one forgotten drop away from the runtime. A projection carrying no capability
  configuration cannot be booted by accident, whatever downstream code does with it.
*/
export function recordResolveCandidates (applications) {
  return applications
    .filter(entry => typeof entry.url === 'string' && entry.url.length > 0)
    .map(({ id, url, path, gitBranch }) => ({ id, url, path, gitBranch }))
}

export function isApplicationEnabled (entry, environment) {
  const { enabled } = entry

  if (typeof enabled === 'undefined') {
    return true
  }

  if (typeof enabled === 'string') {
    return enabled !== 'false'
  }

  if (typeof enabled === 'object' && enabled !== null) {
    return enabled[environment] ?? true
  }

  return enabled
}

/*
  enabled is orchestration, so its value is always lexically present in the root config or in
  autoload.mappings, and the root context already carries production — so disabled entries are
  dropped immediately after expansion, before any per-app worker is spawned, before the detector
  runs, and before capability validation. A decommissioned app whose capability is absent from the
  production image must not be able to fail a boot that excludes it.
*/
export function filterEnabledApplications (applications, environment) {
  return applications.filter(entry => isApplicationEnabled(entry, environment))
}
