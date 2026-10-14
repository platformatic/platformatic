import {
  createDirectory,
  ensureLoggableError,
  findRuntimeConfigurationFile,
  getRoot,
  kMetadata,
  logFatalError,
  parseArgs,
  safeRemove
} from '@platformatic/foundation'
import { loadConfiguration } from '@platformatic/runtime'
import { bold } from 'colorette'
import { execa } from 'execa'
import { existsSync, lstatSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { extract } from 'tar'
import { installDependencies } from './dependencies.js'

// Checks the existence of a path without following symlinks, so that a dangling symlink is
// reported as existing rather than as a free path to write into.
function existsWithoutFollowing (path) {
  try {
    lstatSync(path)
    return true
  } catch {
    return false
  }
}

// Returns the canonical form of a path which might not exist yet: the deepest existing ancestor is
// resolved via realpath and the missing trailing segments are appended to it.
function canonicalize (path) {
  let current = resolve(path)
  let suffix = ''

  while (true) {
    try {
      const real = realpathSync(current)
      return suffix ? resolve(real, suffix) : real
      /* c8 ignore next 8 - The loop always terminates on the root, which exists */
    } catch {
      const parent = dirname(current)

      if (parent === current) {
        return resolve(path)
      }

      suffix = suffix ? join(basename(current), suffix) : basename(current)
      current = parent
    }
  }
}

// Verifies that target is strictly contained in root. A prefix test is not enough as it lacks a path
// segment boundary and thus considers /tmp/app-evil to be inside /tmp/app.
function isPathInside (root, target) {
  const relativePath = relative(root, target)
  return relativePath !== '' && !relativePath.startsWith('..') && !isAbsolute(relativePath)
}

// The containment of the application directory is verified again right before writing to it, as the
// filesystem might have changed since the initial validation.
function verifyApplicationDirectory (root, application) {
  return isPathInside(canonicalize(root), canonicalize(resolve(root, application.path)))
}

function parseGitUrl (url) {
  const fragmentIndex = url.indexOf('#')

  if (fragmentIndex === -1) {
    return { url, branch: null }
  }

  const baseUrl = url.substring(0, fragmentIndex)
  const branch = url.substring(fragmentIndex + 1)

  return { url: baseUrl, branch }
}

async function resolveNpmApplication (application, root, childLogger) {
  const absolutePath = application.path
  const relativePath = relative(root, absolutePath)
  const pkg = application.url.replace(/^npm:/, '')

  childLogger.info(`Resolving application ${bold(application.id)} ...`)

  // Download the package using npm pack. We do that in a temporary directory.
  let temporaryDirectory
  const originalWorkingDirectory = process.cwd()
  try {
    childLogger.info(`Downloading npm package ${bold(pkg)} into ${bold(relativePath)} ...`)

    temporaryDirectory = join(tmpdir(), `wattpm-utils-resolve--${process.pid}-${Date.now()}`)
    await createDirectory(temporaryDirectory)
    process.chdir(temporaryDirectory)

    // The last line of the output is the name of the generated tarball
    const { stdout } = await execa('npm', ['pack', pkg])
    const archive = stdout.trim().split('\n').at(-1)

    await createDirectory(absolutePath)
    await extract({ file: resolve(temporaryDirectory, archive), cwd: absolutePath, strip: 1 })
  } finally {
    await safeRemove(temporaryDirectory)
    process.chdir(originalWorkingDirectory)
  }
}

async function resolveGitApplication (application, root, childLogger, username, password) {
  const absolutePath = application.path
  const relativePath = relative(root, absolutePath)

  childLogger.info(`Resolving application ${bold(application.id)} ...`)

  const parsedGitUrl = parseGitUrl(application.url)
  let url = parsedGitUrl.url
  const effectiveBranch = application.gitBranch ?? parsedGitUrl.branch

  if (url.startsWith('http') && username && password) {
    const parsed = new URL(url)
    parsed.username ||= username
    parsed.password ||= password
    url = parsed.toString()
  }

  const cloneArgs = ['clone', url, absolutePath, '--single-branch', '--depth', 1]

  let branchLabel = ''
  if (effectiveBranch && effectiveBranch !== 'main') {
    cloneArgs.push('--branch', effectiveBranch)
    branchLabel = ` (branch ${bold(effectiveBranch)})`
  }

  if (username) {
    childLogger.info(
      `Cloning ${bold(application.url)}${branchLabel} as user ${bold(username)} into ${bold(relativePath)} ...`
    )
  } else {
    childLogger.info(`Cloning ${bold(application.url)}${branchLabel} into ${bold(relativePath)} ...`)
  }

  await execa('git', cloneArgs)
}

// The boot commands `--for all` covers. `exec` is every non-boot evaluation and prepares nothing.
const BOOT_COMMANDS = ['dev', 'start', 'build']

/*
  Candidates are matched by id, and an id that resolves to two different clones is refused: one
  directory cannot hold two checkouts, and choosing silently is how a deploy ships the wrong code.
  An id present under some commands and absent under others needs no such treatment — it is fetched,
  and a clone nobody boots costs disk.
*/
function unionApplications (logger, evaluations, root) {
  const byId = new Map()

  /*
    The second question the candidate set answers: which repository each destination is claimed by.
    Two ids may share a checkout deliberately -- the same repository at the same revision, fetched
    once -- and two repository/revision pairs landing in one directory is a project where the second
    clone overwrites the first, or the first is silently kept and the second application runs code
    from another repository.

    Mapped before any existence filtering, because a destination that already holds one of the two
    clones is exactly the case this refusal is for: filtering first would drop the evidence.
  */
  const byDestination = new Map()

  for (const { command, config } of evaluations) {
    /*
      The candidates, not the application list: `enabled` must not hide an entry from resolve. It is
      the supported way to keep an application out of a boot, and the eval worker drops the disabled
      ones before the list ever leaves it — so an entry `enabled: false` hides is one whose clone
      never arrives, and the boot that turns it on fails on a directory nobody fetched. v3 has no
      such record and its list is the one it always was.
    */
    const entries = config[kMetadata]?.loader?.resolveCandidates ?? config.applications

    for (const application of entries) {
      const destination = application.path
        ? resolve(root, application.path)
        : resolve(root, `${config.resolvedApplicationsBasePath}/${application.id}`)

      if (application.url) {
        const pair = `${application.url}@${application.gitBranch ?? ''}`
        const claimed = byDestination.get(destination)

        /*
          Between distinct applications only. One id evaluated under two commands can disagree with
          itself about which revision to fetch, and that is the check below -- reporting it here
          would name the same application twice and describe a collision it does not have.
        */
        if (claimed && claimed.id !== application.id && claimed.pair !== pair) {
          logFatalError(
            logger,
            `Applications ${bold(claimed.id)} and ${bold(application.id)} both resolve into ${bold(destination)}, ` +
              `from ${bold(claimed.pair)} and ${bold(pair)}. Give one of them its own path.`
          )

          return null
        }

        if (!claimed) {
          byDestination.set(destination, { id: application.id, pair })
        }
      }

      const seen = byId.get(application.id)

      if (!seen) {
        byId.set(application.id, { application, command, destination })
        continue
      }

      for (const [label, before, after] of [
        ['url', seen.application.url, application.url],
        ['gitBranch', seen.application.gitBranch, application.gitBranch],
        ['destination path', seen.destination, destination]
      ]) {
        if ((before ?? null) !== (after ?? null)) {
          logFatalError(
            logger,
            `Application ${bold(application.id)} resolves to two different clones: ${label} is ` +
              `${bold(before ?? 'unset')} under ${bold(seen.command)} and ${bold(after ?? 'unset')} under ${bold(command)}.`
          )

          return null
        }
      }
    }
  }

  return [...byId.values()].map(entry => entry.application)
}

export async function resolveApplications (
  logger,
  root,
  configurationFile,
  username,
  password,
  skipDependencies,
  packageManager,
  target = 'start',
  mode,
  production
) {
  const evaluations = []

  /*
    The context resolve evaluates is the named command's, with that command's own defaults, so what
    it prepares for is a context some boot actually produces rather than a synthetic one. An earlier
    design evaluated all four and unioned them unconditionally; that was wrong because topology is
    not separable from the rest of the root callback. The same function that returns the application
    list also throws on a missing dev certificate or awaits a discovery lookup, and evaluating it
    under a command nobody asked for runs all of that.

    The union survives as `--for all`, for a project that genuinely branches topology on `command`.
    Because the operator asked for those evaluations, a failure in any of them fails the run.
  */
  for (const command of target === 'all' ? BOOT_COMMANDS : [target]) {
    const config = await loadConfiguration(configurationFile, null, { command, mode, production })

    /* c8 ignore next 3 - Hard to test */
    if (!config) {
      return
    }

    evaluations.push({ command, config })
  }

  const config = evaluations[0].config
  const applications = unionApplications(logger, evaluations, root)

  if (!applications) {
    return
  }

  // The applications which might be to be resolved are the one that have a URL and either
  // no path defined (which means no environment variable set) or a non-existing path (which means not resolved yet)
  const resolvableApplications = applications.filter(application => {
    if (!application.url) {
      return false
    }

    if (application.path && existsSync(application.path)) {
      logger.warn(`Skipping application ${bold(application.id)} as the path already exists.`)
      return false
    }

    return true
  })

  // Iterate the applications a first time to verify the environment files configuration and which applications must be resolved
  const toResolve = []
  const fetching = new Map()

  // Simply use application.path here
  for (const application of resolvableApplications) {
    if (!application.path) {
      application.path = resolve(root, `${config.resolvedApplicationsBasePath}/${application.id}`)
    }

    const directory = resolve(root, application.path)

    // If the directory already exists, it's either external or already resolved, nothing to do in both cases
    if (!existsWithoutFollowing(directory)) {
      if (!verifyApplicationDirectory(root, application)) {
        logger.warn(
          `Skipping application ${bold(application.id)} as the non existent directory ${bold(
            application.path
          )} is outside the project directory.`
        )
      } else if (fetching.has(directory)) {
        /*
          A destination two applications share deliberately -- same repository, same revision, which
          the union check above already confirmed. Cloning it twice would have the second clone write
          over the first while the first is still being used.
        */
        logger.info(
          `Application ${bold(application.id)} shares the checkout at ${bold(application.path)} with ${bold(fetching.get(directory))}, which is fetched once.`
        )
      } else {
        // This repository must be resolved
        fetching.set(directory, application.id)
        toResolve.push(application)
      }
    } else {
      logger.warn(
        `Skipping application ${bold(application.id)} as the generated path ${bold(
          join(config.resolvedApplicationsBasePath, application.id)
        )} already exists.`
      )
    }
  }

  // Resolve the applications
  for (const application of toResolve) {
    const childLogger = logger.child({ name: application.id })

    // Revalidate right before writing, as the filesystem might have changed since the check above
    if (!verifyApplicationDirectory(root, application)) {
      return logFatalError(
        childLogger,
        `Cannot resolve application ${bold(application.id)} as the directory ${bold(
          application.path
        )} is outside the project directory.`
      )
    }

    let operation
    try {
      if (application.url.startsWith('npm')) {
        operation = 'download npm package'
        await resolveNpmApplication(application, root, childLogger)
      } else {
        operation = 'clone repository'
        await resolveGitApplication(application, root, childLogger, username, password)
      }
    } catch (error) {
      return logFatalError(
        childLogger,
        { error: ensureLoggableError(error) },
        `Unable to ${operation} of the application ${bold(application.id)}.`
      )
    }
  }

  // Install dependencies
  if (!skipDependencies) {
    // Revalidate once more, as installing runs arbitrary lifecycle scripts from the resolved directories
    for (const application of toResolve) {
      if (!verifyApplicationDirectory(root, application)) {
        return logFatalError(
          logger.child({ name: application.id }),
          `Cannot install dependencies of the application ${bold(application.id)} as the directory ${bold(
            application.path
          )} is outside the project directory.`
        )
      }
    }

    return await installDependencies(logger, root, toResolve, false, packageManager)
  }
  /* c8 ignore next - Mistakenly reported as uncovered by C8 */
  return true
}

export async function resolveCommand (logger, args) {
  const {
    values: {
      config,
      username,
      password,
      'skip-dependencies': skipDependencies,
      'package-manager': packageManager,
      for: target,
      mode,
      production
    },
    positionals
  } = parseArgs(
    args,
    {
      config: {
        type: 'string',
        short: 'c'
      },
      /*
        resolve does not default production and mode the way other exec-context commands do: the
        target chosen by --for supplies them, so `--for start` evaluates what `wattpm start` boots.
        The flags override where a deployment is neither — `--for start --mode staging` resolves
        what `wattpm start --mode staging` will boot.
      */
      for: {
        type: 'string',
        default: 'start'
      },
      mode: {
        type: 'string'
      },
      production: {
        type: 'boolean'
      },
      username: {
        type: 'string',
        short: 'u',
        default: process.env.WATTPM_RESOLVE_USERNAME
      },
      password: {
        type: 'string',
        short: 'p',
        default: process.env.WATTPM_RESOLVE_PASSWORD
      },
      'skip-dependencies': {
        type: 'boolean',
        short: 's',
        default: false
      },
      'package-manager': {
        type: 'string',
        short: 'P'
      }
    },
    false
  )

  const root = getRoot(positionals)
  const configurationFile = await findRuntimeConfigurationFile(
    logger,
    root,
    config,
    true,
    true,
    true,
    this.executableName
  )

  if (target !== 'all' && !BOOT_COMMANDS.includes(target)) {
    return logFatalError(
      logger,
      `Invalid value ${bold(target)} for --for. Use one of ${BOOT_COMMANDS.map(c => bold(c)).join(', ')} or ${bold('all')}.`
    )
  }

  const resolved = await resolveApplications(
    logger,
    root,
    // Level 0: the loader is handed the directory and synthesizes. Nothing in a configless tree is
    // a remote application, so this resolves the dependencies and finds nothing to fetch.
    configurationFile ?? root,
    username,
    password,
    skipDependencies,
    packageManager,
    target,
    mode,
    production
  )

  if (resolved) {
    logger.done('All applications have been resolved.')
  }
}

export const help = {
  resolve: {
    usage: 'resolve [root]',
    description: 'Resolves all external applications',
    args: [
      {
        name: 'root',
        description: 'The directory containing the project (the default is the current directory)'
      }
    ],
    options: [
      {
        usage: '-c, --config <config>',
        description: 'Name of the configuration file to use (the default to autodetect it)'
      },
      {
        usage: '-u, --username <value>',
        description: 'The username to use for HTTP URLs'
      },
      {
        usage: '-p, --password <value>',
        description: 'The password to use for HTTP URLs'
      },
      {
        usage: '-s, --skip-dependencies',
        description: 'Do not install applications dependencies'
      },
      {
        usage: '-P, --package-manager <executable>',
        description: 'Use an alternative package manager (the default is to autodetect it)'
      },
      {
        usage: '--for <command>',
        description:
          'Prepare for the given boot command — dev, start or build — or "all" to cover every one (the default is start)'
      },
      {
        usage: '--mode <name>',
        description: 'Override the mode the target command would use'
      },
      {
        usage: '--production',
        description: 'Override the production flag the target command would use'
      }
    ],
    footer () {
      return `
${this.executableId} resolve command resolves runtime applications that have the \`url\` in their configuration.
To change the directory where an application is cloned, you can set the \`path\` property in the application configuration.

Resolve does not rewrite the configuration. Applications without a path use the resolved-applications base directory.

Example of a runtime \`watt.config.js\`:

\`\`\`js
import { createWattConfig } from 'wattpm'

export default createWattConfig({
  applications: [
    { id: 'local', path: './applications/local' },
    { id: 'remote', url: 'https://github.com/test-owner/test-application.git', gitBranch: 'production' }
  ]
})
\`\`\`

Use \`--config\` to select a file explicitly. Otherwise Watt discovers \`watt.config.ts\`,
\`watt.config.js\`, \`watt.config.mjs\`, or \`watt.config.cjs\`.

You can find more details about the configuration format here:
* [Platformatic DB Configuration](https://docs.platformatic.dev/docs/reference/db/configuration)
* [Platformatic Application Configuration](https://docs.platformatic.dev/docs/reference/service/configuration)
    `
    }
  }
}
