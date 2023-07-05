export function getTsConfig (outDir) {
  return {
    compilerOptions: {
      module: 'commonjs',
      esModuleInterop: true,
      target: 'es2019',
      sourceMap: true,
      pretty: true,
      noEmitOnError: true,
      outDir
    },
    watchOptions: {
      watchFile: 'fixedPollingInterval',
      watchDirectory: 'fixedPollingInterval',
      fallbackPolling: 'dynamicPriority',
      synchronousWatchDirectory: true,
      excludeDirectories: ['**/node_modules', outDir]
    }
  }
}
