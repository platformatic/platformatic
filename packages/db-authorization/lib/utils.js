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
      rolesRaw = rolesRaw[key]
    }
  } else {
    rolesRaw = user[roleKey]
  }

  if (typeof rolesRaw === 'string') {
    output = rolesRaw.split(',')
  } else if (Array.isArray(rolesRaw)) {
    output = rolesRaw
  }
  if (output.length === 0) {
    output.push(anonymousRole)
  }

  return output
}
