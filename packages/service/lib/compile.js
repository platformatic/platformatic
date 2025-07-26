export function getTypescriptCompilationOptions (config) {
  return {
    tsConfig: config.plugins?.typescript?.tsConfig,
    flags: config.plugins?.typescript?.flags
  }
}
