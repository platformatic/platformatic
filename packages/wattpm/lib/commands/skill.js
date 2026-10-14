import { ensureLoggableError, logFatalError, parseArgs } from '@platformatic/foundation'
import { readFile, realpath } from 'node:fs/promises'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import { InvalidSkillFileError, SkillFileNotFoundError } from '../errors.js'

const skillDirectory = resolve(import.meta.dirname, '../../skills/watt')

export async function readSkillFile (file = 'SKILL.md') {
  // Only bundled Markdown references may be read, including through symlinks.
  const candidate = resolve(skillDirectory, file)
  const path = relative(skillDirectory, candidate)
  if (isAbsolute(file) || path === '..' || path.startsWith(`..${sep}`) || !path.endsWith('.md')) {
    throw new InvalidSkillFileError(file)
  }

  let canonical
  try {
    canonical = await realpath(candidate)
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
      throw new SkillFileNotFoundError(file)
    }
    throw error
  }

  const canonicalRoot = await realpath(skillDirectory)
  const canonicalPath = relative(canonicalRoot, canonical)
  if (canonicalPath === '..' || canonicalPath.startsWith(`..${sep}`) || isAbsolute(canonicalPath)) {
    throw new InvalidSkillFileError(file)
  }

  return readFile(canonical, 'utf-8')
}

export async function skillCommand (logger, args) {
  const { positionals } = parseArgs(args, {}, false)

  try {
    if (positionals.length > 1) {
      throw new InvalidSkillFileError(positionals.join(' '))
    }

    // Preserve the source verbatim, without a logo, logger prefix, or extra newline.
    process.stdout.write(await readSkillFile(positionals[0]))
  } catch (error) {
    return logFatalError(logger, { error: ensureLoggableError(error) }, error.message)
  }
}

export const help = {
  skill: {
    usage: 'skill [FILE]',
    description: 'Print the bundled Watt agent skill or one of its Markdown references to stdout',
    args: [{ name: 'FILE', description: 'A bundled skill file, relative to the Watt skill directory (default: SKILL.md)' }]
  }
}
