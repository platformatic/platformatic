import dependenciesRule from './rules/dependencies.js'

const rules = {
  npmDependencies: dependenciesRule
}

async function getCompliancyMetadata (config) {
  const metadata = {}

  await Promise.allSettled(
    Object.keys(rules).map(async (ruleName) => {
      metadata[ruleName] = await rules[ruleName](config)
    })
  )

  return metadata
}

export {
  getCompliancyMetadata
}
