import { cp, mkdir, rm } from 'node:fs/promises'

// Bundle the documentation source at build time; published CLI use is entirely offline.
const target = new URL('../skills/', import.meta.url)
await mkdir(target, { recursive: true })
await rm(new URL('watt/', target), { recursive: true, force: true })
await cp(new URL('../../../docs/skills/watt', import.meta.url), new URL('watt/', target), { recursive: true })
