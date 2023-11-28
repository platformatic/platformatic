import { say } from './say.mjs'
import path, { basename } from 'node:path'
import { safeMkdir } from './utils.mjs'
import { createGitignore } from './create-gitignore.mjs'
import { createGitRepository } from './create-git-repository.mjs'
import { getPkgManager } from './get-pkg-manager.mjs'
import pino from 'pino'
import pretty from 'pino-pretty'
import { execa } from 'execa'
import ora from 'ora'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

async function importOrLocal ({ pkgManager, name, projectDir, pkg }) {
  try {
    return await import(pkg)
  } catch (err) {
    // This file does not need to exists, will be created automatically
    const pkgJsonPath = path.join(projectDir, 'package.json')
    const _require = createRequire(pkgJsonPath)

    try {
      const fileToImport = _require.resolve(pkg)
      return await import(pathToFileURL(fileToImport))
    } catch {}

    const spinner = ora(`Installing ${pkg}...`).start()
    await execa(pkgManager, ['install', pkg], { cwd: projectDir })
    spinner.succeed()

    const fileToImport = _require.resolve(pkg)
    return await import(pathToFileURL(fileToImport))
  }
}

export const createPlatformatic = async ({ projectDir, services }) => {
  const logger = pino(pretty({
    translateTime: 'SYS:HH:MM:ss',
    ignore: 'hostname,pid'
  }))

  const pkgManager = getPkgManager()

  const projectName = basename(projectDir)

  await safeMkdir(projectDir)

  await say('Installing platformatic and @platformatic/runtime')

  const runtime = await importOrLocal({
    pkgManager,
    name: projectName,
    projectDir,
    pkg: '@platformatic/runtime'
  })

  const generator = new runtime.Generator({
    name: projectName
  })
  generator.setConfig({
    ...generator.config,
    targetDirectory: projectDir
  })

  let entrypoint = ''
  for (const service of services) {
    const stackableName = service.stackable
    const serviceName = service.name
    if (!entrypoint && service.entrypoint) {
      entrypoint = serviceName
    }

    const stackable = await importOrLocal({
      pkgManager,
      name: projectName,
      projectDir,
      pkg: stackableName
    })

    const stackableGenerator = new stackable.Generator({
    })

    stackableGenerator.setConfig({
      ...stackableGenerator.config,
      serviceName,
      plugin: true,
      tests: true
    })

    generator.addService(stackableGenerator, serviceName)
  }

  generator.setEntryPoint(entrypoint)

  await generator.prepare()
  await generator.writeFiles()

  // Create project here

  await createGitignore(logger, projectDir)
  await createGitRepository(logger, projectDir)

  const spinner = ora('Installing dependencies...').start()
  await execa(pkgManager, ['install'], { cwd: projectDir })
  spinner.succeed()
}

createPlatformatic({
  projectDir: process.cwd() + '/for-marco',
  services: [{
    name: 'foo',
    stackable: '@platformatic/service'
  }, {
    name: 'bar',
    stackable: '@platformatic/service',
    entrypoint: true
  }]
})
