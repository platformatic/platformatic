import { readdir, readFile } from 'node:fs/promises'
import { isAbsolute, join, resolve } from 'node:path'
import { AmbiguousApplicationIdError, DuplicateAutoloadedApplicationIdError } from './errors.js'
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

  /*
    v3's ids were directory names, unique by construction. v4 prefers the package.json name, which
    is not: two directories copied from one another carry the same name. The shallow merge below is
    a rule for an autoloaded entry meeting an *explicit* one, and applying it to two autoloaded
    directories would silently absorb the second — an application that never boots and nothing that
    says so.
  */
  const autoloaded = new Map()

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

    const claimed = autoloaded.get(id)

    if (claimed) {
      throw new DuplicateAutoloadedApplicationIdError(claimed, directory, id)
    }

    autoloaded.set(id, directory)

    const expanded = { id, path: directory, ...mapping }
    const existing = applications.findIndex(application => application.id === id)

    if (existing !== -1) {
      const explicit = applications[existing]

      /*
        A shared id merges only once the two are known to be the same application, which for a
        local entry means the same resolved path -- normalized, not canonicalized: a symlink
        spelling of the autoloaded directory is refused rather than recognized, loudly, with the
        rename as the fix. v3 matched on id alone, and an explicit
        { id, url } beside an autoloaded directory then merged into an entry that kept the local
        path *and* carried the url -- resolve skipped the remote because its path existed, and the
        runtime booted local code while the configuration named a repository (#5079). An id is the
        mesh hostname, the injected variable, the metrics label and inject's argument, so two
        distinct applications cannot share one.
      */
      const samePath = typeof explicit.path === 'string' && resolve(root, explicit.path) === directory

      if (!samePath) {
        const described =
          typeof explicit.path === 'string'
            ? `path '${explicit.path}'`
            : typeof explicit.url === 'string'
              ? `url '${explicit.url}'`
              : 'neither path nor url'
        throw new AmbiguousApplicationIdError(directory, described, id)
      }

      /*
        Shallow explicit-wins merge, v3 semantics, applied to the explicit entry *in place*: a
        deferred config slot recorded before expansion addresses this object by identity, and
        replacing it would leave the slot pointing at an entry the topology no longer holds -- the
        application would boot without the configuration its author wrote, and nothing would say so.
      */
      for (const key of Object.keys(expanded)) {
        if (!(key in explicit)) {
          explicit[key] = expanded[key]
        }
      }
    } else {
      applications.push(expanded)
    }
  }

  return applications
}

/*
  A remote application's directory, which exists only in memory until `resolve` fetches the clone.
  The loader needs it before that: per-app discovery, the detector and capability validation all
  work from a directory, and v4 resolves every application when the root is read. v3 could defer
  this to the runtime's `#setupApplication`, because per-app configuration was read worker-side.

  It is relative, like an authored path, so the same resolution against the configuration's own
  directory applies to both. Applied after the resolve candidates are recorded: an entry that
  declared no path is one `resolve` reports by the generated location rather than by a path the
  project never wrote.
*/
export function backfillRemotePaths (applications, base) {
  for (const entry of applications) {
    if (entry.url && !entry.path) {
      entry.path = join(base, entry.id)
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
    // packageManager travels with the candidate because resolve installs the clone's dependencies
    // as its last step, and the entry is the only place that says which manager to use for it.
    .map(({ id, url, path, gitBranch, packageManager }) => ({ id, url, path, gitBranch, packageManager }))
}

/*
  The object form is keyed by mode, not by a separate binary environment. production and
  development remain the default mode names under start/build and dev, so every v3 configuration
  keeps its meaning — and enabled: { staging: false } now does what it looks like under
  --mode staging, where v3 silently ignored the key because it only ever compared against those
  two names.
*/
export function isApplicationEnabled (entry, mode) {
  const { enabled } = entry

  if (typeof enabled === 'undefined') {
    return true
  }

  if (typeof enabled === 'string') {
    return enabled !== 'false'
  }

  if (typeof enabled === 'object' && enabled !== null) {
    return enabled[mode] ?? true
  }

  return enabled
}

/*
  enabled is orchestration, so its value is always lexically present in the root config or in
  autoload.mappings, and the root context already carries the mode — so disabled entries are
  dropped immediately after expansion, before any per-app worker is spawned, before the detector
  runs, and before capability validation. A decommissioned app whose capability is absent from the
  production image must not be able to fail a boot that excludes it.
*/
export function filterEnabledApplications (applications, mode) {
  return applications.filter(entry => isApplicationEnabled(entry, mode))
}
