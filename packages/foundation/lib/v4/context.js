import { isAbsolute, resolve } from 'node:path'

export const configurationCommands = ['dev', 'build', 'start', 'exec']

// production is the common-case shortcut: true under start and --production, and under build,
// because a build produces production artifacts.
export function isProductionCommand (command) {
  return command === 'start' || command === 'build'
}

// mode defaults to development under dev and production under build/start. exec is every non-boot
// evaluation, so it takes its answer from the production flag it was given rather than inventing a
// third default.
export function defaultMode (command, production) {
  return (production ?? isProductionCommand(command)) ? 'production' : 'development'
}

/*
  One context object is handed to every callback in a file, so it is frozen rather than merely
  typed Readonly: a config that wrote to ctx.env would change what later deferred entries observe,
  make the result depend on evaluation order, and do it without tripping the process.env mutation
  warning, which watches a different object.
*/
export function createConfigurationContext ({ command, mode, production, env, root, onWatchFile } = {}) {
  const resolvedProduction = production ?? isProductionCommand(command)
  const resolvedMode = mode ?? defaultMode(command, resolvedProduction)
  const snapshot = Object.freeze({ ...env })

  // addWatchFile is the one member that is a function rather than data, and it does not make the
  // context mutable: it reports a path outward and returns nothing, so two callbacks in one file
  // cannot observe each other through it. Outside a watching command it is a no-op, which keeps a
  // config that calls it from behaving differently under start.
  function addWatchFile (path) {
    if (typeof path !== 'string' || path.length === 0 || !onWatchFile) {
      return
    }

    // Relative paths resolve against ctx.root — the config file's own directory, the only stable
    // referent, since a helper that calls this may live anywhere and process.cwd() is wherever the
    // command was typed.
    onWatchFile(isAbsolute(path) ? path : resolve(root, path))
  }

  return Object.freeze({
    command,
    mode: resolvedMode,
    production: resolvedProduction,
    env: snapshot,
    root,
    addWatchFile
  })
}
