import { ensureLoggableError, logFatalError, parseArgs } from '@platformatic/foundation'
import { readFile, realpath, stat } from 'node:fs/promises'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import { InvalidSkillFileError, SkillFileNotFoundError } from '../errors.js'

const skillDirectory = resolve(import.meta.dirname, '../../skills/watt')

export async function readSkillFile (file = 'SKILL.md') {
  // Restrict reads to Markdown in this release's bundle, including symlink targets.
  const candidate = resolve(skillDirectory, file)
  const path = relative(skillDirectory, candidate)
  if (isAbsolute(file) || path === '..' || path.startsWith(`..${sep}`) || !path.endsWith('.md') || file.includes('\0')) {
    throw new InvalidSkillFileError(file)
  }

  try {
    const canonicalRoot = await realpath(skillDirectory)
    const canonical = await realpath(candidate)
    const canonicalPath = relative(canonicalRoot, canonical)
    if (
      canonicalPath === '..' || canonicalPath.startsWith(`..${sep}`) ||
      isAbsolute(canonicalPath) || !canonicalPath.endsWith('.md') || !(await stat(canonical)).isFile()
    ) {
      throw new InvalidSkillFileError(file)
    }

    return await readFile(canonical, 'utf-8')
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
      throw new SkillFileNotFoundError(file)
    }
    throw error
  }
}

export async function skillCommand (logger, args) {
  const { positionals } = parseArgs(args, {}, false)

  try {
    if (positionals.length > 1) {
      throw new InvalidSkillFileError(positionals.join(' '))
    }

    // Preserve Markdown verbatim so agents can consume it without CLI decoration.
    process.stdout.write(await readSkillFile(positionals[0]))
  } catch (error) {
    return logFatalError(logger, { error: ensureLoggableError(error) }, error.message)
  }
}

export const help = {
  skill: {
    usage: 'skill [FILE]',
    description: 'Print the bundled Watt agent skill or one of its Markdown references to stdout',
    args: [{ name: 'FILE', description: 'A bundled Markdown file, relative to the Watt skill directory (default: SKILL.md)' }]
  }
}
