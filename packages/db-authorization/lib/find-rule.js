const PLT_ADMIN_ROLE = 'platformatic-admin'

export function findRule (rules, roles) {
  const matchingRules = []

  for (const rule of rules) {
    for (const role of roles) {
      if (rule.role === role) {
        matchingRules.push(rule)
        break
      }
    }
  }

  if (matchingRules.length === 0) {
    return null
  }

  if (matchingRules.length === 1) {
    return matchingRules[0]
  }

  // Filter out platformatic-admin when other roles are present
  // This enables user impersonation: admin can test with user's exact permissions
  const nonAdminRules = matchingRules.filter(rule => rule.role !== PLT_ADMIN_ROLE)
  const rulesToMerge = nonAdminRules.length > 0 ? nonAdminRules : matchingRules

  if (rulesToMerge.length === 1) {
    return rulesToMerge[0]
  }

  const mergedRule = { ...rulesToMerge[0] }

  for (let i = 1; i < rulesToMerge.length; i++) {
    const rule = rulesToMerge[i]

    for (const key of Object.keys(rule)) {
      if (key === 'role' || key === 'entity') {
        continue
      }

      const currentValue = mergedRule[key]
      const newValue = rule[key]

      if (newValue && !currentValue) {
        mergedRule[key] = newValue
      }
    }
  }

  return mergedRule
}
