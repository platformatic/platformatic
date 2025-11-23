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

  const mergedRule = { ...matchingRules[0] }

  for (let i = 1; i < matchingRules.length; i++) {
    const rule = matchingRules[i]

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
