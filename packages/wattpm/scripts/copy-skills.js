import { cp, mkdir, rm } from 'node:fs/promises'

// Bundle release-matched documentation for offline use, removing stale references.
const target = new URL('../skills/', import.meta.url)
await mkdir(target, { recursive: true })
await rm(new URL('watt/', target), { recursive: true, force: true })
await cp(new URL('../../../docs/skills/watt', import.meta.url), new URL('watt/', target), { recursive: true })
