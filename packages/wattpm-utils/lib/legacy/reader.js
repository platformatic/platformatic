/*
  Migrate's own reader for v3 configuration files.

  This is a copy of what `@platformatic/foundation` does, and it is a copy on purpose. Migrate has
  to keep understanding v3 for as long as anyone has a v3 project to convert, which is longer than
  v4 has any reason to carry the code -- foundation's copy exists only while the v3 loader is still
  in the tree, and it goes when that does. Sharing it would tie the one tool that must not change
  its reading of v3 to the package with the most reason to change.

  It also releases on a different cadence: `npx wattpm-utils migrate` resolves at invocation time,
  so a fix here reaches every installed v4 runtime without a runtime release.
*/

import toml from '@iarna/toml'
import JSON5 from 'json5'
import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'
import { parse as rawParseYAML } from 'yaml'

const { parse: parseJSON5 } = JSON5
const { parse: parseTOML } = toml

export const legacyConfigurationFileExtensions = ['json', 'json5', 'yaml', 'yml', 'toml', 'tml']

/*
  The `$schema` URLs v3 shipped, across the move between the two hosts. Both are matched because the
  corpus spans it: a configuration written years ago carries the older `platformatic.dev/schemas/`
  form and is no less a v3 configuration for it.
*/
export const legacyConfigurationSchemas = [
  /^https:\/\/platformatic.dev\/schemas\/(v?)(?<version>[^/]+)\/(?<module>.*)/,
  /^https:\/\/schemas.platformatic.dev\/@platformatic\/(?<module>.*)\/(v?)(?<version>[^/]+)\.json/,
  /^https:\/\/schemas.platformatic.dev\/(?<module>wattpm)\/(v?)(?<version>[^/]+)\.json/
]

/*
  v3's YAML pre-pass. `port: {PORT}` is a flow mapping to a YAML parser and a placeholder to v3, so
  every unquoted `{...}` outside a string is quoted before parsing. It exists nowhere in v4 -- there
  are no placeholders -- and it has to stay here, because the files migrate reads were written
  against it.
*/
function parseYAML (raw, ...args) {
  const bracesRegexp = /{(\d+|[a-z$_][\w\-$]*?(?:\.[\w\-$]*?)*?)}/gi
  const stringRegexp = /(["'])(?:(?=(\\?))\2.)*?\1/gi

  const stringMatches = [...raw.matchAll(stringRegexp)]

  raw = raw.replace(bracesRegexp, (match, p1, offset) => {
    for (const stringMatch of stringMatches) {
      const stringStart = stringMatch.index
      const stringEnd = stringMatch.index + stringMatch[0].length

      if (offset >= stringStart && offset <= stringEnd) {
        return match
      }
    }

    return `'${match}'`
  })

  return rawParseYAML(raw, ...args)
}

export function getLegacyParser (path) {
  switch (extname(path)) {
    case '.yaml':
    case '.yml':
      return parseYAML
    case '.json':
      return JSON.parse
    case '.json5':
      return parseJSON5
    case '.toml':
    case '.tml':
      return parseTOML
    default:
      throw new Error(`${path} does not have a configuration file extension migrate recognizes.`)
  }
}

export async function loadLegacyConfigurationFile (path) {
  try {
    return getLegacyParser(path)(await readFile(path, 'utf-8'))
  } catch (error) {
    throw new Error(`Cannot parse ${path}: ${error.message}`, { cause: error })
  }
}

/*
  Which capability a v3 file declares. `module` wins where it is present -- that is the v4 spelling,
  and a file carrying it is already halfway here -- and otherwise the `$schema` URL is the only
  statement of identity a v3 file makes.
*/
export function extractLegacyModule (config, throwOnMissing = false) {
  if (typeof config?.module === 'string') {
    return config
  }

  if (typeof config?.$schema !== 'string') {
    if (throwOnMissing) {
      throw new Error('The configuration declares neither a module nor a known $schema.')
    }

    return null
  }

  const matching = legacyConfigurationSchemas.map(matcher => config.$schema.match(matcher)).find(match => match)

  if (!matching) {
    if (throwOnMissing) {
      throw new Error('The configuration declares neither a module nor a known $schema.')
    }

    return null
  }

  const { module: name, version } = matching.groups

  return { module: `@platformatic/${name === 'wattpm' ? 'runtime' : name}`, version }
}
