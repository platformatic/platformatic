export function getRequestFromContext (ctx) {
  if (ctx && !ctx.reply) {
    throw new Error('Missing reply in context. You should call this function with { ctx: { reply }}')
  }
  return ctx.reply.request
}

export function getRoles (request, roleKey, anonymousRole, isRolePath = false) {
  let output = []
  const user = request.user
  if (!user) {
    output.push(anonymousRole)
    return output
  }

  let rolesRaw
  if (isRolePath) {
    const roleKeys = roleKey.split('.')
    rolesRaw = user
    for (const key of roleKeys) {
      if (rolesRaw === null || rolesRaw === undefined || typeof rolesRaw !== 'object') {
        rolesRaw = undefined
        break
      }
      rolesRaw = rolesRaw[key]
    }
  } else {
    rolesRaw = user[roleKey]
  }

  if (typeof rolesRaw === 'string') {
    output = rolesRaw.split(',').map(role => role.trim()).filter(Boolean)
  } else if (Array.isArray(rolesRaw)) {
    output = rolesRaw.filter(role => typeof role === 'string').map(role => role.trim()).filter(Boolean)
  }
  if (output.length === 0) {
    output.push(anonymousRole)
  }

  return output
}
