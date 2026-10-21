import { ok, rejects, strictEqual } from 'node:assert'
import { mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { test } from 'node:test'
import { readSkillFile } from '../lib/commands/skill.js'
import { createTemporaryDirectory, wattpm } from './helper.js'

const sourceDirectory = resolve(import.meta.dirname, '../../../docs/skills/watt')

test('skill - prints the complete source outside a Watt project without logger output', async t => {
  const cwd = await createTemporaryDirectory(t, 'skill')
  const source = await readFile(resolve(sourceDirectory, 'SKILL.md'), 'utf-8')
  strictEqual(await readSkillFile(), source)
  const result = await wattpm('skill', { cwd, stripFinalNewline: false })
  strictEqual(result.stdout, source)
  strictEqual(result.stderr, '')
})

test('skill - reads every bundled reference', async () => {
  const files = await readdir(resolve(sourceDirectory, 'references'), { recursive: true })
  for (const name of files.filter(file => file.endsWith('.md'))) {
    const file = `references/${name}`
    strictEqual(await readSkillFile(file), await readFile(resolve(sourceDirectory, file), 'utf-8'))
  }

  for (const file of ['references/frameworks.md', 'references/frameworks/nextjs.md', 'references/deployment/docker.md']) {
    const result = await wattpm('skill', file, { stripFinalNewline: false })
    strictEqual(result.stdout, await readSkillFile(file))
    strictEqual(result.stderr, '')
  }
  strictEqual(await readSkillFile('references/frameworks/../frameworks.md'), await readSkillFile('references/frameworks.md'))
})

test('skill - bundles all locally linked Markdown references', async () => {
  const files = await readdir(sourceDirectory, { recursive: true })
  for (const file of files.filter(file => file.endsWith('.md'))) {
    const source = await readSkillFile(file)
    for (const [, link] of source.matchAll(/\]\(([^)]+\.md)(?:#[^)]*)?\)/g)) {
      if (link.startsWith('https://')) {
        continue
      }

      // Resolve links from the referring document, including nested framework guides.
      const target = relative(sourceDirectory, resolve(sourceDirectory, dirname(file), link))
      strictEqual(await readSkillFile(target), await readFile(resolve(sourceDirectory, target), 'utf-8'))
    }
  }
})

test('skill - rejects paths outside the bundle and non-Markdown files', async () => {
  for (const file of ['../README.md', '../../package.json', resolve(sourceDirectory, 'SKILL.md'), 'references', 'bad\0.md']) {
    await rejects(readSkillFile(file), { code: 'PLT_INVALID_SKILL_FILE' })
  }
  await rejects(readSkillFile('missing.md'), { code: 'PLT_SKILL_FILE_NOT_FOUND' })
  await rejects(readSkillFile('SKILL.md/missing.md'), { code: 'PLT_SKILL_FILE_NOT_FOUND' })
})

test('skill - validates symlink targets and rejects directories named as Markdown', async t => {
  const bundleDirectory = resolve(import.meta.dirname, '../skills/watt')
  const fixture = resolve(bundleDirectory, 'test-skill-paths')
  await mkdir(fixture)
  t.after(() => rm(fixture, { recursive: true, force: true }))
  await mkdir(resolve(fixture, 'directory.md'))
  await writeFile(resolve(fixture, 'plain.txt'), 'not Markdown')
  await symlink(resolve(sourceDirectory, 'SKILL.md'), resolve(fixture, 'outside.md'))
  await symlink(resolve(fixture, 'plain.txt'), resolve(fixture, 'disguised.md'))
  await symlink(resolve(bundleDirectory, 'SKILL.md'), resolve(fixture, 'inside.md'))

  for (const file of ['directory.md', 'outside.md', 'disguised.md']) {
    await rejects(readSkillFile(`test-skill-paths/${file}`), { code: 'PLT_INVALID_SKILL_FILE' })
  }
  strictEqual(await readSkillFile('test-skill-paths/inside.md'), await readSkillFile())
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
  const flag = await wattpm('skill', '--help')
  ok(flag.stdout.includes('Usage: wattpm skill [FILE]'))
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
