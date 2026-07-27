import { defineNitroConfig } from 'nitropack/config'

export default defineNitroConfig({
  compatibilityDate: '2026-01-01',
  experimental: { tasks: true },
  modules: ['@platformatic/nitro/scheduler'],
  scheduledTasks: {
    '0 0 1 1 *': ['smoke']
  }
})
