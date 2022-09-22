'use strict'

function getRequestFromContext (ctx) {
  if (!ctx || !ctx.reply) {
    throw new Error('Missing context. You should call this function with { ctx: { reply }}')
  }
  return ctx.reply.request
}

function getRoles (request, roleKey, anonymousRole) {
  let output = []
  const user = request.user
  if (!user) {
    output.push(anonymousRole)
    return output
  }

  const rolesRaw = user[roleKey]
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
module.exports = {
  getRequestFromContext,
  getRoles
}
