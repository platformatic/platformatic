import { ok } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { createRuntime, updateConfigFile } from './helpers.js'
import { prepareRuntime } from './multiple-workers/helper.js'

test('metrics with useV2Metrics uses serviceId label instead of applicationId', async t => {
  const tempDir = await prepareRuntime(t, 'no-multiple-workers', { node: ['node'] })
  const configFile = join(tempDir, 'platformatic.json')

  // Update config to enable useV2Metrics
  await updateConfigFile(configFile, config => {
    config.metrics = {
      port: 0,
      useV2Metrics: true
    }
    // Set entrypoint to the first service
    config.entrypoint = 'node'
    return config
  })

  const runtime = await createRuntime(configFile)

  t.after(async () => {
    await runtime.close()
  })

  await runtime.start()

  const { metrics } = await runtime.getMetrics()
  const metricsText = metrics.map(m => m.name + '{' + Object.entries(m.values[0]?.labels || {}).map(([k, v]) => `${k}="${v}"`).join(',') + '}').join('\n')

  // Verify that metrics use serviceId label instead of applicationId
  ok(metricsText.includes('serviceId="node"'), 'Metrics should contain serviceId label')
  ok(!metricsText.includes('applicationId='), 'Metrics should not contain applicationId label')

  // Check specific metrics with serviceId
  ok(metricsText.includes('nodejs_version_info') && metricsText.includes('serviceId="node"'), 'nodejs_version_info should have serviceId')
  ok(metricsText.includes('process_cpu_percent_usage') && metricsText.includes('serviceId="node"'), 'process_cpu_percent_usage should have serviceId')
})

test('metrics without useV2Metrics uses applicationId label (default behavior)', async t => {
  const tempDir = await prepareRuntime(t, 'no-multiple-workers', { node: ['node'] })
  const configFile = join(tempDir, 'platformatic.json')

  // Update config to explicitly enable metrics without useV2Metrics
  await updateConfigFile(configFile, config => {
    config.metrics = {
      port: 0
      // useV2Metrics is not set, so it should default to false
    }
    // Set entrypoint to the first service
    config.entrypoint = 'node'
    return config
  })

  const runtime = await createRuntime(configFile)

  t.after(async () => {
    await runtime.close()
  })

  await runtime.start()

  const { metrics } = await runtime.getMetrics()
  const metricsText = metrics.map(m => m.name + '{' + Object.entries(m.values[0]?.labels || {}).map(([k, v]) => `${k}="${v}"`).join(',') + '}').join('\n')

  // Verify that metrics use applicationId label (default behavior)
  ok(metricsText.includes('applicationId="node"'), 'Metrics should contain applicationId label')
  ok(!metricsText.includes('serviceId='), 'Metrics should not contain serviceId label')

  // Check specific metrics with applicationId
  ok(metricsText.includes('nodejs_version_info') && metricsText.includes('applicationId="node"'), 'nodejs_version_info should have applicationId')
  ok(metricsText.includes('process_cpu_percent_usage') && metricsText.includes('applicationId="node"'), 'process_cpu_percent_usage should have applicationId')
})

test('getFormattedMetrics handles serviceId label when useV2Metrics is enabled', async t => {
  const tempDir = await prepareRuntime(t, 'no-multiple-workers', { node: ['node'] })
  const configFile = join(tempDir, 'platformatic.json')

  // Update config to enable useV2Metrics
  await updateConfigFile(configFile, config => {
    config.metrics = {
      port: 0,
      useV2Metrics: true
    }
    // Set entrypoint to the first service
    config.entrypoint = 'node'
    return config
  })

  const runtime = await createRuntime(configFile)

  t.after(async () => {
    await runtime.close()
  })

  await runtime.start()

  // Get formatted metrics which aggregates metrics by application
  const { applications } = await runtime.getFormattedMetrics()

  // Should have metrics for 'node' application
  ok(applications.node, 'Should have metrics for node application')
  ok(typeof applications.node.cpu === 'number', 'Should have cpu metric')
  ok(typeof applications.node.rss === 'number', 'Should have rss metric')
  ok(typeof applications.node.elu === 'number', 'Should have elu metric')
})
