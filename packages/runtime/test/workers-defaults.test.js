import assert from 'node:assert/strict'
import { availableParallelism } from 'node:os'
import { test } from 'node:test'
import { createWorkersConfig } from './predictive-scaling/helpers.js'

test('configuration normalization supplies predictive worker defaults', async () => {
  const workers = await createWorkersConfig({ dynamic: true })
  assert.deepEqual(workers, {
    dynamic: true,
    static: 1,
    total: availableParallelism(),
    eluThreshold: 0.8,
    processIntervalMs: 10000,
    maxScaleUpStep: 1,
    redistributionMs: 10000,
    alphaUp: 0.2,
    alphaDown: 0.1,
    betaUp: 0.1,
    betaDown: 0.1,
    cooldowns: {
      scaleUpAfterScaleUpMs: 5000,
      scaleUpAfterScaleDownMs: 5000,
      scaleDownAfterScaleUpMs: 30000,
      scaleDownAfterScaleDownMs: 20000
    }
  })
  // The memory limit depends on the deployment environment and is resolved at startup.
  assert.equal(workers.maxMemory, undefined)
})

test('worker defaults preserve zero values and fill partial cooldown settings', async () => {
  const workers = await createWorkersConfig({
    total: 8,
    maxMemory: 123456,
    eluThreshold: 0.7,
    alphaUp: 0,
    redistributionMs: 0,
    cooldowns: { scaleUpAfterScaleUpMs: 0 }
  })
  assert.equal(workers.total, 8)
  assert.equal(workers.maxMemory, 123456)
  assert.equal(workers.eluThreshold, 0.7)
  assert.equal(workers.alphaUp, 0)
  assert.equal(workers.redistributionMs, 0)
  assert.deepEqual(workers.cooldowns, {
    scaleUpAfterScaleUpMs: 0,
    scaleUpAfterScaleDownMs: 5000,
    scaleDownAfterScaleUpMs: 30000,
    scaleDownAfterScaleDownMs: 20000
  })
})

test('separate configurations receive independent cooldown objects', async () => {
  const firstWorkersConfig = await createWorkersConfig()
  const secondWorkersConfig = await createWorkersConfig()
  firstWorkersConfig.cooldowns.scaleDownAfterScaleUpMs = 0
  assert.equal(secondWorkersConfig.cooldowns.scaleDownAfterScaleUpMs, 30000)
})
