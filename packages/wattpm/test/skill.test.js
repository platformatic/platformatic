import { ok, rejects, strictEqual } from 'node:assert'
import { readFile, symlink, unlink } from 'node:fs/promises'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { readSkillFile } from '../lib/commands/skill.js'
import { wattpm } from './helper.js'

const sourceDirectory = resolve(import.meta.dirname, '../../../docs/skills/watt')

test('skill - prints the complete source without logger output', async () => {
  const source = await readFile(resolve(sourceDirectory, 'SKILL.md'), 'utf-8')
  strictEqual(await readSkillFile(), source)
  const result = await wattpm('skill', { stripFinalNewline: false })
  strictEqual(result.stdout, source)
  strictEqual(result.stderr, '')
})

test('skill - reads every bundled reference', async () => {
  for (const name of ['scaffolding', 'frameworks', 'services', 'integration', 'migration-v4', 'operations']) {
    const file = `references/${name}.md`
    strictEqual(await readSkillFile(file), await readFile(resolve(sourceDirectory, file), 'utf-8'))
  }

  const result = await wattpm('skill', 'references/frameworks.md', { stripFinalNewline: false })
  strictEqual(result.stdout, await readSkillFile('references/frameworks.md'))
})

test('skill - rejects paths outside the bundle and non-Markdown files', async () => {
  for (const file of ['../README.md', '../../package.json', resolve(sourceDirectory, 'SKILL.md'), 'references']) {
    await rejects(readSkillFile(file), { code: 'PLT_INVALID_SKILL_FILE' })
  }
  await rejects(readSkillFile('missing.md'), { code: 'PLT_SKILL_FILE_NOT_FOUND' })
})

test('skill - refuses symlinks outside the bundle', async t => {
  const link = resolve(import.meta.dirname, '../skills/watt/escape.md')
  await symlink(resolve(sourceDirectory, 'SKILL.md'), link)
  t.after(() => unlink(link))
  await rejects(readSkillFile('escape.md'), { code: 'PLT_INVALID_SKILL_FILE' })
})

test('skill - reports missing files and extra arguments as CLI failures', async () => {
  const missing = await wattpm('skill', 'missing.md', { reject: false })
  strictEqual(missing.exitCode, 1)
  ok(missing.stdout.includes('PLT_SKILL_FILE_NOT_FOUND'))

  const extra = await wattpm('skill', 'SKILL.md', 'other.md', { reject: false })
  strictEqual(extra.exitCode, 1)
  ok(extra.stdout.includes('PLT_INVALID_SKILL_FILE'))
})

test('skill - exposes command help and replaces scaffolding commands', async () => {
  const help = await wattpm('help', 'skill')
  ok(help.stdout.includes('Usage: wattpm skill [FILE]'))
  const general = await wattpm('help')
  ok(general.stdout.includes('skill [FILE]'))
  ok(!general.stdout.includes('Creates a new Watt project'))
})

test('skill - removed scaffolding commands fail instead of invoking a generator', async () => {
  for (const command of ['create', 'init', 'add', 'import']) {
    const result = await wattpm(command, { reject: false })
    strictEqual(result.exitCode, 1)
    ok(result.stdout.includes(`Unknown command ${command}`))
  }
})
