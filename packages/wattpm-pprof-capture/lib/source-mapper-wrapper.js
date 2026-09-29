import path from 'node:path'
import { extractFunctionName, isMinifiedName } from './function-name.js'

// Same values of SourceMapConsumer.GREATEST_LOWER_BOUND and
// SourceMapConsumer.LEAST_UPPER_BOUND in the source-map module
const GREATEST_LOWER_BOUND = 1
const LEAST_UPPER_BOUND = 2

const NEWLINE = 10

/**
 * Wrapper around SourceMapper that:
 *
 * - fixes Windows path normalization issues.
 *   On Windows, V8 profiler returns paths like `file:///D:/path/to/file.js`.
 *   The @datadog/pprof library removes `file://` leaving `/D:/path/to/file.js`,
 *   but SourceMapper stores paths as `D:\path\to\file.js`.
 *
 * - resolves locations which have no mapping at or before their column.
 *   Bundlers like Turbopack generate minified files where the mappings of a
 *   line start after the loader code, so the lookup is retried searching for
 *   the nearest mapping on the right.
 *
 * - resolves the original function names when the source map has no name
 *   mappings, which is the case of React bundled in Next.js. The names are
 *   extracted from the sources embedded in the source map.
 */
export class SourceMapperWrapper {
  #caches

  constructor (innerMapper) {
    this.innerMapper = innerMapper
    this.debug = innerMapper.debug
    this.#caches = new WeakMap()
  }

  /**
   * Normalize Windows-style paths from V8 profiler to match SourceMapper format.
   * Handles paths like `/D:/path/to/file.js` -> `D:\path\to\file.js`
   */
  normalizePath (filePath) {
    if (process.platform !== 'win32') {
      return filePath
    }

    // Handle paths like /D:/path/to/file -> D:\path\to\file
    // This happens because pprof removes 'file://' from 'file:///D:/path/to/file'
    if (filePath.startsWith('/') && filePath.length > 2 && filePath[2] === ':') {
      // Remove leading slash and convert forward slashes to backslashes
      return filePath.slice(1).replace(/\//g, '\\')
    }

    // Also convert any forward slashes to backslashes on Windows
    return filePath.replace(/\//g, '\\')
  }

  hasMappingInfo (inputPath) {
    const normalized = this.normalizePath(inputPath)
    return this.innerMapper.hasMappingInfo(normalized)
  }

  mappingInfo (location) {
    const normalized = {
      ...location,
      file: this.normalizePath(location.file)
    }

    const protocols = ['webpack:', 'turbopack:']
    const mappedInfo = this.#resolve(normalized)
    // The @datadog/pprof SourceMapper uses path.resolve() which treats webpack: URLs
    // as relative paths, creating malformed paths like:
    // /path/to/.next/server/app/api/heavy/webpack:/next/src/app/api/heavy/route.js
    // We need to extract just the webpack: URL part. The same applies to the
    // turbopack: URLs of the Turbopack runtime.

    for (const protocol of protocols) {
      if (!mappedInfo.file) continue

      const webpackIndex = mappedInfo.file.indexOf(protocol)
      if (webpackIndex > 0) {
        // Extract just the webpack: URL
        mappedInfo.file = mappedInfo.file.substring(webpackIndex)
      }
    }
    return mappedInfo
  }

  #getEntry (file) {
    if (typeof file !== 'string' || typeof this.innerMapper.getMappingInfo !== 'function') {
      return null
    }

    const entry = this.innerMapper.getMappingInfo(file)
    if (typeof entry?.mapConsumer?.originalPositionFor !== 'function') {
      return null
    }

    return entry
  }

  #resolve (location) {
    const entry = this.#getEntry(location.file)
    if (entry === null) {
      // The inner mapper also reports the files with a missing source map
      return this.innerMapper.mappingInfo(location)
    }

    const consumer = entry.mapConsumer
    const generated = {
      line: location.line,
      // SourceMapConsumer expects a 0-based column
      column: location.column > 0 ? location.column - 1 : 0
    }

    // A column 0 means that there is no real column information
    let bias = generated.column === 0 ? LEAST_UPPER_BOUND : GREATEST_LOWER_BOUND
    let position = consumer.originalPositionFor({ ...generated, bias })

    if (position.source === null && bias === GREATEST_LOWER_BOUND) {
      bias = LEAST_UPPER_BOUND
      position = consumer.originalPositionFor({ ...generated, bias })
    }

    if (position.source === null) {
      return location
    }

    let name = position.name
    if (!name && isMinifiedName(location.name)) {
      name = this.#getOriginalName(consumer, position)
    }

    return {
      file: path.resolve(entry.mapFileDir, position.source),
      line: position.line || undefined,
      name: name || location.name,
      // Convert the column back to 1-based
      column: position.column === null ? undefined : position.column + 1
    }
  }

  #getOriginalName (consumer, position) {
    if (!position.line || typeof consumer.sourceContentFor !== 'function') {
      return null
    }

    let cache = this.#caches.get(consumer)
    if (!cache) {
      cache = { sources: new Map(), names: new Map() }
      this.#caches.set(consumer, cache)
    }

    const key = `${position.source}:${position.line}:${position.column}`
    let name = cache.names.get(key)
    if (name !== undefined) {
      return name
    }

    try {
      name = extractFunctionName(this.#getSourceLine(consumer, cache, position), position.column ?? 0)
    } catch {
      name = null
    }

    cache.names.set(key, name)
    return name
  }

  #getSourceLine (consumer, cache, position) {
    let source = cache.sources.get(position.source)
    if (source === undefined) {
      const content = consumer.sourceContentFor(position.source, true)
      source = typeof content === 'string' ? { content, offsets: getLineOffsets(content) } : null
      cache.sources.set(position.source, source)
    }

    if (source === null || position.line > source.offsets.length) {
      return null
    }

    const start = source.offsets[position.line - 1]
    const end = position.line < source.offsets.length ? source.offsets[position.line] - 1 : source.content.length
    const line = source.content.slice(start, end)

    return line.endsWith('\r') ? line.slice(0, -1) : line
  }
}

// The offsets of the beginning of each line: splitting the sources in lines
// would duplicate in memory the sources embedded in the source maps
function getLineOffsets (content) {
  const offsets = [0]
  for (let i = 0; i < content.length; i++) {
    if (content.charCodeAt(i) === NEWLINE) {
      offsets.push(i + 1)
    }
  }

  return Uint32Array.from(offsets)
}
