// A sampler as a module: the factory receives `options` from the configuration
// and returns the sampler. Deterministic on purpose, so a test can assert an
// exact count.
export default function createSampler ({ every = 2 } = {}) {
  let seen = 0

  return {
    shouldSample () {
      // 2 = RECORD_AND_SAMPLED, 0 = NOT_RECORD
      return { decision: ++seen % every === 0 ? 2 : 0 }
    },
    toString () {
      return `OneIn${every}`
    }
  }
}
