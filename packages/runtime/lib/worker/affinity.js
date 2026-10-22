// 32-bit FNV-1a, followed by the MurmurHash3 finalizer to improve the distribution of similar inputs
function hash (value) {
  let h = 0x811c9dc5

  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }

  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16

  return h >>> 0
}

// Rendezvous (highest random weight) hashing: every caller computes the same worker for the same key and set of
// workers, and when a worker is added or removed only the keys owned by that worker move.
export function pickByAffinity (workers, key) {
  let selected
  let selectedScore = -1

  for (const worker of workers) {
    const score = hash(`${key}\0${worker.id}`)

    if (score > selectedScore || (score === selectedScore && worker.id < selected.id)) {
      selected = worker
      selectedScore = score
    }
  }

  return selected
}
