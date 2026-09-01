import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { AmbiguousConfigurationFileError, LegacyConfigurationFileError } from './errors.js'

// The four recognized v4 filenames. Exactly one may exist in a directory.
export const configurationFileExtensions = ['ts', 'mts', 'js', 'mjs']
export const configurationFileNames = configurationFileExtensions.map(extension => `watt.config.${extension}`)

// The complete v3 candidate set. Legacy detection is unconditional and by filename alone —
// no parsing, no shape heuristics — so this table is the whole of it. It is deliberately
// duplicated from the v3 machinery rather than imported: that machinery leaves foundation.
export const legacyConfigurationFileExtensions = ['json', 'json5', 'yaml', 'yml', 'toml', 'tml']
export const legacyConfigurationFileSuffixes = [
  'runtime',
  'application',
  'service',
  'db',
  'gateway',
  'composer'
]

export const legacyConfigurationFileNames = (function listLegacyConfigurationFileNames () {
  const names = []

  for (const extension of legacyConfigurationFileExtensions) {
    names.push(`watt.${extension}`, `platformatic.${extension}`)
  }

  for (const suffix of legacyConfigurationFileSuffixes) {
    for (const extension of legacyConfigurationFileExtensions) {
      names.push(`watt.${suffix}.${extension}`, `platformatic.${suffix}.${extension}`)
    }
  }

  return names
})()

const legacyConfigurationFileNamesSet = new Set(legacyConfigurationFileNames)
const configurationFileNamesSet = new Set(configurationFileNames)

// One directory read serves both tables. Returning the raw listing lets callers that already
// walked a directory answer both questions without a second stat storm.
export async function listDirectoryEntries (directory) {
  try {
    /*
      Directories are excluded: every caller is selecting a configuration file, and a directory
      named `watt.config.js` would otherwise be returned as a candidate and reach `import()` as a
      raw ERR_UNSUPPORTED_DIR_IMPORT blaming the loader rather than the directory. readdir does not
      follow symlinks, so a symlink *to* a directory reports isSymbolicLink() and passes an
      isDirectory() test -- its target type has to be resolved with a following stat, or the same
      raw import error slips through the discovery path. A broken symlink resolves to nothing and is
      dropped too, since it is not a file that can be imported.
    */
    const entries = await readdir(directory, { withFileTypes: true })

    const kept = await Promise.all(
      entries.map(async entry => {
        if (entry.isDirectory()) {
          return null
        }

        if (entry.isSymbolicLink()) {
          try {
            if ((await stat(join(directory, entry.name))).isDirectory()) {
              return null
            }
          } catch {
            return null
          }
        }

        return entry.name
      })
    )

    return kept.filter(name => name !== null)
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR' || error.code === 'EACCES') {
      return []
    }

    throw error
  }
}

export function selectConfigurationFileNames (entries) {
  // Ordered by the canonical extension order rather than by directory order, so the ambiguity
  // error reads the same on every filesystem.
  return configurationFileNames.filter(name => entries.includes(name))
}

export function selectLegacyConfigurationFileNames (entries) {
  return entries.filter(entry => legacyConfigurationFileNamesSet.has(entry)).sort()
}

export function isConfigurationFileName (name) {
  return configurationFileNamesSet.has(name)
}

export function isLegacyConfigurationFileName (name) {
  return legacyConfigurationFileNamesSet.has(name)
}

// Consulting a directory means both checks, in this order: a legacy file is an error even next
// to a v4 one, so it is reported before the ambiguity check can shadow it.
export async function inspectDirectory (directory) {
  const entries = await listDirectoryEntries(directory)
  const legacy = selectLegacyConfigurationFileNames(entries)

  if (legacy.length > 0) {
    throw new LegacyConfigurationFileError(join(directory, legacy[0]))
  }

  const candidates = selectConfigurationFileNames(entries)

  if (candidates.length > 1) {
    throw new AmbiguousConfigurationFileError(directory, candidates.join(', '))
  }

  return candidates.length === 1 ? join(directory, candidates[0]) : null
}

// Synthesis is never refused on account of a configuration above, but it does say so — and the
// scan looks for the complete candidate set rather than only the v4 names, because a v3 monorepo
// is exactly where a configless subpackage is most likely to be found. Synthesizing there while an
// ancestor platformatic.json describes the application is the same silence with an older filename.
export async function findAnyConfigurationFile (directory) {
  const entries = await listDirectoryEntries(directory)
  const candidates = selectConfigurationFileNames(entries)

  if (candidates.length > 0) {
    return { path: join(directory, candidates[0]), legacy: false }
  }

  const legacy = selectLegacyConfigurationFileNames(entries)

  return legacy.length > 0 ? { path: join(directory, legacy[0]), legacy: true } : null
}

// The env-root and watch-horizon scans are filename checks that execute nothing and decide
// nothing about which configuration boots, so they never raise the ambiguity error: a directory
// that has two candidates still has a configuration in it.
export async function hasConfigurationFile (directory) {
  const entries = await listDirectoryEntries(directory)

  return selectConfigurationFileNames(entries).length > 0
}
