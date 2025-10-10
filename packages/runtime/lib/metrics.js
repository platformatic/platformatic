import { readFile } from 'node:fs/promises'
import si from 'systeminformation'

async function readNumberFromCgroupFile (path) {
  try {
    const raw = (await readFile(path, 'utf8')).trim()
    if (raw === 'max') return null
    return Number(raw)
  } catch {
    return null
  }
}

async function getCgroupV2MemoryInfo () {
  let [total, used] = await Promise.all([
    readNumberFromCgroupFile('/sys/fs/cgroup/memory.max'),
    readNumberFromCgroupFile('/sys/fs/cgroup/memory.current')
  ])
  if (total == null && used == null) return null

  if (total === null) {
    const mem = await si.mem()
    total = mem.total
  }

  return { scope: 'cgroup-v2', used, total }
}

async function getCgroupV1MemoryInfo () {
  let [total, used] = await Promise.all([
    readNumberFromCgroupFile('/sys/fs/cgroup/memory/memory.limit_in_bytes'),
    readNumberFromCgroupFile('/sys/fs/cgroup/memory/memory.usage_in_bytes')
  ])
  if (total == null && used == null) return null

  // Some v1 setups report 9.22e18 (≈unlimited)
  if (total === null || total > 1e18) {
    const mem = await si.mem()
    total = mem.total
  }

  return { scope: 'cgroup-v1', used, total }
}

async function readHostMemoryInfo () {
  const mem = await si.mem()
  return { scope: 'host', used: mem.active, total: mem.total }
}

export async function getMemoryInfo (options = {}) {
  const scope = options.scope

  if (scope === 'cgroup-v2') {
    return getCgroupV2MemoryInfo()
  }
  if (scope === 'cgroup-v1') {
    return getCgroupV1MemoryInfo()
  }
  if (scope === 'host') {
    return readHostMemoryInfo()
  }

  let memInfo = await getCgroupV2MemoryInfo()

  if (!memInfo) {
    memInfo = await getCgroupV1MemoryInfo()
  }
  if (!memInfo) {
    memInfo = await readHostMemoryInfo()
  }

  return memInfo
}
