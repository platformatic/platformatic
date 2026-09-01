import { basename, dirname, isAbsolute, join, parse, resolve } from 'node:path'
import { stat } from 'node:fs/promises'
import { isFileAccessible } from '../file-system.js'
import { ConfigurationFileNotFoundError, LegacyConfigurationFileError } from './errors.js'
import {
  configurationFileNames,
  findAnyConfigurationFile,
  hasConfigurationFile,
  inspectDirectory,
  isConfigurationFileName,
  isLegacyConfigurationFileName
} from './filenames.js'

export function ancestorDirectories (directory) {
  const directories = []
  const filesystemRoot = parse(directory).root
  let current = directory

  while (true) {
    directories.push(current)

    if (current === filesystemRoot) {
      break
    }

    const parent = dirname(current)

    if (parent === current) {
      break
    }

    current = parent
  }

  return directories
}

// A directory holding a package.json is where a Node project begins, so a configuration above it
// belongs to something else. This is the whole of the trust story for the config search.
export async function findPackageBoundary (directory) {
  for (const candidate of ancestorDirectories(directory)) {
    if (await isFileAccessible('package.json', candidate)) {
      return candidate
    }
  }

  return null
}

// Step 1 of "run what is here": find the nearest watt.config.* from `directory` upward, stopping
// at — and including — the nearest ancestor containing a package.json, and searching `directory`
// alone when there is no such ancestor. By filename alone; nothing is executed.
export async function findDecidingFile (directory, { throwOnMissing = false } = {}) {
  const packageBoundary = await findPackageBoundary(directory)
  const stopDirectory = packageBoundary ?? directory

  for (const candidate of ancestorDirectories(directory)) {
    const found = await inspectDirectory(candidate)

    if (found) {
      return { path: found, directory: candidate, stopDirectory }
    }

    if (candidate === stopDirectory) {
      break
    }
  }

  if (throwOnMissing) {
    throw new ConfigurationFileNotFoundError(directory, stopDirectory)
  }

  return null
}

// --config names the configuration and takes cwd out of the decision. It accepts any of the four
// v4 names and nothing else: pointing it at a v3 file is the migrate hint, not a parse attempt.
export async function resolveNamedConfigurationFile (path, cwd = process.cwd()) {
  const resolved = isAbsolute(path) ? path : resolve(cwd, path)
  const name = basename(resolved)

  if (isLegacyConfigurationFileName(name)) {
    throw new LegacyConfigurationFileError(resolved)
  }

  if (!isConfigurationFileName(name)) {
    throw new ConfigurationFileNotFoundError(resolved, configurationFileNames.join(', '))
  }

  // stat, not access: a directory named watt.config.js is accessible, and passing it on reaches
  // import() as a raw ERR_UNSUPPORTED_DIR_IMPORT. A configuration is a file.
  let stats
  try {
    stats = await stat(resolved)
  } catch {
    throw new ConfigurationFileNotFoundError(resolved, dirname(resolved))
  }

  if (!stats.isFile()) {
    throw new ConfigurationFileNotFoundError(resolved, dirname(resolved))
  }

  return { path: resolved, directory: dirname(resolved), stopDirectory: dirname(resolved) }
}

// The ancestor scan is the one thing that looks above the search stop point. It executes nothing,
// and it never decides which configuration boots — but it is not diagnostics-only either: it
// selects the env root, and the env root decides how far up .env layering reaches.
export async function scanAncestorConfigurations (directory) {
  const found = []

  for (const candidate of ancestorDirectories(directory)) {
    if (await hasConfigurationFile(candidate)) {
      found.push(candidate)
    }
  }

  return found
}

// A config file's chain runs from its own directory up to and including the directory of the
// outermost watt.config.* above it — or its own directory alone when there is none. The
// own-directory floor is what makes every chain terminate.
export async function findEnvRoot (directory) {
  const found = await scanAncestorConfigurations(directory)

  return found.length > 0 ? found[found.length - 1] : directory
}

// The watched horizon is the scan's reach, not its current answer: watching only as far as the
// present env root cannot see a configuration appearing above it, which is exactly the event that
// moves the root outward. These paths mostly do not exist — they are watched for creation.
export function listAncestorCandidatePaths (directory) {
  const paths = []

  for (const candidate of ancestorDirectories(directory)) {
    for (const name of configurationFileNames) {
      paths.push(join(candidate, name))
    }
  }

  return paths
}

// The standalone warning fires when the deciding file classified as an application definition and
// a watt.config.* exists in some ancestor directory. Because it is a filename check it cannot know
// whether that ancestor is a root config, so the caller names the file rather than asserting.
export async function findAncestorConfiguration (directory) {
  const parent = dirname(directory)

  if (parent === directory) {
    return null
  }

  const found = await scanAncestorConfigurations(parent)

  return found.length > 0 ? found[0] : null
}

// The same walk, over both candidate sets, for the zero-config warning. It stops at the first
// ancestor that has anything, since that is the file the user is asked about.
export async function findAncestorConfigurationOfAnyKind (directory) {
  const parent = dirname(directory)

  if (parent === directory) {
    return null
  }

  for (const candidate of ancestorDirectories(parent)) {
    const found = await findAnyConfigurationFile(candidate)

    if (found) {
      return found
    }
  }

  return null
}

// Per-app discovery consults a directory the same way the walk does, with one exception: a
// candidate that is the deciding file itself is skipped, whatever the entry's shape, so an entry
// with a defaulted path does not discover the very file that produced it. Entries that carry an
// inline config use the same call — for them a returned path is the configured-twice error, not a
// file to evaluate — which is why the legacy and ambiguity checks belong here rather than at the
// two call sites.
export async function findApplicationConfigurationFile (directory, decidingFile) {
  const found = await inspectDirectory(directory)

  if (!found || found === decidingFile) {
    return null
  }

  return found
}
