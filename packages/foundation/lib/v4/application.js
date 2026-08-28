import { dirname } from 'node:path'
import { NotASingleApplicationError } from './errors.js'
import { loadConfiguration } from './load.js'

/*
  One application's configuration read from a file, in the shape a worker receives it: the
  capability's own validated configuration, where it lives, and the environment the loader resolved
  for it.

  A capability's CLI commands start here when they are pointed at a file rather than handed the
  configuration the runtime already resolved -- `plt db migrations apply -c watt.config.mjs` rather
  than `wattpm db:migrations:apply`. The file is a program, so there is nothing to parse: it is
  evaluated by the same loader a boot uses, and the answer is the same one the boot would produce.

  The default command is `exec`, which is what every non-boot evaluation is: nothing starts, so a
  configuration branching on `command` sees a context that matches what is actually happening.
*/
export async function loadApplicationConfigurationFile (path, options = {}) {
  const loaded = await loadConfiguration({
    cwd: dirname(path),
    configPath: path,
    command: 'exec',
    ...options
  })

  const applications = loaded.config.applications ?? []

  /*
    Exactly one, because a command reads one application's configuration and cannot be asked to
    guess which. A root that describes several is not an error to load -- it is an error to point
    this at, which is what the message says.
  */
  if (applications.length !== 1) {
    throw new NotASingleApplicationError(
      path,
      applications.length,
      applications.map(application => application.id).join(', ') || 'none'
    )
  }

  const [application] = applications

  return {
    root: application.path,
    config: application.config ?? {},
    env: application.workerEnv ?? {},
    module: application.module,
    loaded
  }
}
