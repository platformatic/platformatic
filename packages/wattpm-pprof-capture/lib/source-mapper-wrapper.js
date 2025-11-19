/**
 * Wrapper around SourceMapper that fixes Windows path normalization issues.
 *
 * On Windows, V8 profiler returns paths like `file:///D:/path/to/file.js`.
 * The @datadog/pprof library removes `file://` leaving `/D:/path/to/file.js`,
 * but SourceMapper stores paths as `D:\path\to\file.js`.
 *
 * This wrapper normalizes Windows paths to match the internal format.
 */
export class SourceMapperWrapper {
  constructor (innerMapper) {
    this.innerMapper = innerMapper
    this.debug = innerMapper.debug
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

    const protocols = ['webpack:']
    const mappedInfo = this.innerMapper.mappingInfo(normalized)
    if (mappedInfo.file?.includes('webpack:')) {
      process._rawDebug('---------- mappingInfo ----------', location, mappedInfo)
    }
    // The @datadog/pprof SourceMapper uses path.resolve() which treats webpack: URLs
    // as relative paths, creating malformed paths like:
    // /path/to/.next/server/app/api/heavy/webpack:/next/src/app/api/heavy/route.js
    // We need to extract just the webpack: URL part

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
}
