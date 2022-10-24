'use strict'

const fp = require('fastify-plugin')
const createError = require('@fastify/error')
const { getRequestFromContext, getRoles } = require('./lib/utils')
const findRule = require('./lib/find-rule')

const PLT_ADMIN_ROLE = 'platformatic-admin'
const Unauthorized = createError('PLT_DB_AUTH_UNAUTHORIZED', 'operation not allowed', 401)
const UnauthorizedField = createError('PLT_DB_AUTH_UNAUTHORIZED', 'field not allowed: %s', 401)
const MissingNotNullableError = createError('PLT_DB_AUTH_NOT_NULLABLE_MISSING', 'missing not nullable field: "%s" in save rule for entity "%s"')

async function auth (app, opts) {
  if (opts.jwt) {
    app.register(require('./lib/jwt'), opts.jwt)
  } else if (opts.webhook) {
    app.register(require('./lib/webhook'), opts.webhook)
  }

  const adminSecret = opts.adminSecret
  const roleKey = opts.roleKey || 'X-PLATFORMATIC-ROLE'
  const anonymousRole = opts.anonymousRole || 'anonymous'

  app.addHook('preHandler', async (request) => {
    if (request.ws) {
      // we have not received the WebSocket headers yet.
      // we are postponing this to the first subscription
      return
    }

    return setupUser(request)
  })

  async function setupUser (request) {
    let forceAdminRole = false
    if (adminSecret && request.headers['x-platformatic-admin-secret'] === adminSecret) {
      if (opts.jwt || opts.webhook) {
        forceAdminRole = true
      } else {
        request.log.info('admin secret is valid')
        request.user = new Proxy(request.headers, {
          get: (target, key) => {
            let value
            if (!target[key]) {
              const newKey = key.toLowerCase()
              value = target[newKey]
            } else {
              value = target[key]
            }

            if (!value && key.toLowerCase() === roleKey.toLowerCase()) {
              value = PLT_ADMIN_ROLE
            }
            return value
          }
        })
      }
    }

    try {
      // `createSession` actually exists only if jwt or webhook are enabled
      // and creates a new `request.user` object
      await request.createSession()
    } catch (err) {
      request.log.trace({ err })
    }

    if (forceAdminRole) {
      // We replace just the role in `request.user`, all the rest is untouched
      request.user = {
        ...request.user,
        [roleKey]: PLT_ADMIN_ROLE
      }
    }
  }

  const rules = opts.rules || []

  app.platformatic.addRulesForRoles = (_rules) => {
    for (const rule of _rules) {
      rules.push(rule)
    }
  }

  app.addHook('onReady', function () {
    const entityRules = {}
    // TODO validate that there is at most a rule for a given role
    for (const rule of rules) {
      if (!entityRules[rule.entity]) {
        entityRules[rule.entity] = []
      }
      entityRules[rule.entity].push(rule)
    }

    for (const entityKey of Object.keys(app.platformatic.entities)) {
      const rules = entityRules[entityKey] || []
      const type = app.platformatic.entities[entityKey]

      if (adminSecret) {
        rules.push({
          role: PLT_ADMIN_ROLE,
          find: true,
          save: true,
          delete: true
        })
      }

      // If we have `fields` in save rules, we need to check if all the not-nullable
      // fields are specified
      checkSaveMandatoryFieldsInRules(type, rules)

      // We have subscriptions!
      let userPropToFillForPublish
      /* istanbul ignore else */
      if (app.platformatic.mq) {
        for (const rule of rules) {
          const checks = rule.find?.checks
          if (typeof checks !== 'object') {
            continue
          }
          for (const key of Object.keys(checks)) {
            /* istanbul ignore next */
            const val = checks[key] || checks[key].eq
            /* istanbul ignore else */
            if (val) {
              /* istanbul ignore else */
              if (userPropToFillForPublish === undefined) {
                userPropToFillForPublish = { key, val }
              } else if (userPropToFillForPublish.val !== val) {
                throw new Error('Unable to configure subscriptions and authorization due to multiple check clauses in find')
              }
            }
          }
        }
      }

      app.platformatic.addEntityHooks(entityKey, {
        async find (originalFind, { where, ctx, fields, ...restOpts }) {
          const request = getRequestFromContext(ctx)
          const rule = findRuleForRequestUser(ctx, rules, roleKey, anonymousRole)
          checkFieldsFromRule(rule.find, fields)
          where = await fromRuleToWhere(ctx, rule.find, where, request.user)

          return originalFind({ ...restOpts, where, ctx, fields })
        },

        async save (originalSave, { input, ctx, fields }) {
          const request = getRequestFromContext(ctx)
          const rule = findRuleForRequestUser(ctx, rules, roleKey, anonymousRole)

          if (!rule.save) {
            throw new Unauthorized()
          }
          checkFieldsFromRule(rule.save, fields)
          checkInputFromRuleFields(rule.save, input)

          if (rule.defaults) {
            for (const key of Object.keys(rule.defaults)) {
              const defaults = rule.defaults[key]
              if (typeof defaults === 'function') {
                input[key] = await defaults({ user: request.user, ctx, input })
              } else {
                input[key] = request.user[defaults]
              }
            }
          }

          if (input[type.primaryKey]) {
            const where = await fromRuleToWhere(ctx, rule.save, {
              [type.primaryKey]: {
                eq: input[type.primaryKey]
              }
            }, request.user)

            const found = await type.find({
              where,
              ctx,
              fields
            })

            if (found.length === 0) {
              throw new Unauthorized()
            }

            return originalSave({ input, ctx, fields })
          }

          return originalSave({ input, ctx, fields })
        },

        async insert (originalInsert, { inputs, ctx, fields }) {
          const request = getRequestFromContext(ctx)
          const rule = findRuleForRequestUser(ctx, rules, roleKey, anonymousRole)

          if (!rule.save) {
            throw new Unauthorized()
          }

          checkFieldsFromRule(rule.save, fields)
          checkInputFromRuleFields(rule.save, inputs)

          /* istanbul ignore else */
          if (rule.defaults) {
            for (const input of inputs) {
              for (const key of Object.keys(rule.defaults)) {
                const defaults = rule.defaults[key]
                if (typeof defaults === 'function') {
                  input[key] = await defaults({ user: request.user, ctx, input })
                } else {
                  input[key] = request.user[defaults]
                }
              }
            }
          }

          return originalInsert({ inputs, ctx, fields })
        },

        async delete (originalDelete, { where, ctx, fields }) {
          const request = getRequestFromContext(ctx)
          const rule = findRuleForRequestUser(ctx, rules, roleKey, anonymousRole)

          where = await fromRuleToWhere(ctx, rule.delete, where, request.user)

          return originalDelete({ where, ctx, fields })
        },

        async getPublishTopic (original, opts) {
          const request = opts.ctx.reply.request
          const originalTopic = await original(opts)
          if (userPropToFillForPublish) {
            return `/${userPropToFillForPublish.key}/${request.user[userPropToFillForPublish.val] || ''}${originalTopic}`
          }
          return originalTopic
        },

        async getSubscriptionTopic (original, opts) {
          const { ctx } = opts
          if (ctx.request.user === undefined) {
            await setupUser(ctx.request)
          }
          // TODO make sure anonymous users cannot subscribe

          const request = getRequestFromContext(ctx)

          const originalTopic = await original(opts)

          /* istanbul ignore next */
          if (userPropToFillForPublish) {
            return `/${userPropToFillForPublish.key}/${request.user[userPropToFillForPublish.val] || '+'}${originalTopic}`
          }

          return originalTopic
        }
      })
    }
  })
}

async function fromRuleToWhere (ctx, rule, where, user) {
  if (!rule) {
    throw new Unauthorized()
  }
  const request = getRequestFromContext(ctx)
  /* istanbul ignore next */
  where = where || {}

  if (typeof rule === 'object') {
    const { checks } = rule

    /* istanbul ignore else */
    if (checks) {
      for (const key of Object.keys(checks)) {
        const clauses = checks[key]
        if (typeof clauses === 'string') {
        // case: "userId": "X-PLATFORMATIC-USER-ID"
          where[key] = {
            eq: request.user[clauses]
          }
        } else {
        // case:
        // userId: {
        //   eq: 'X-PLATFORMATIC-USER-ID'
        // }
          for (const clauseKey of Object.keys(clauses)) {
            const clause = clauses[clauseKey]
            where[key] = {
              [clauseKey]: request.user[clause]
            }
          }
        }
      }
    }
  } else if (typeof rule === 'function') {
    where = await rule({ user, ctx, where })
  }
  return where
}

function findRuleForRequestUser (ctx, rules, roleKey, anonymousRole) {
  const roles = getRoles(getRequestFromContext(ctx), roleKey, anonymousRole)
  const rule = findRule(rules, roles)
  if (!rule) {
    ctx.reply.log.warn({ roles }, 'no rule for roles')
    throw new Unauthorized()
  }
  return rule
}

function checkFieldsFromRule (rule, fields) {
  if (!rule) {
    throw new Unauthorized()
  }
  const { fields: fieldsFromRule } = rule
  /* istanbul ignore else */
  if (fieldsFromRule) {
    for (const field of fields) {
      if (!fieldsFromRule.includes(field)) {
        throw new UnauthorizedField(field)
      }
    }
  }
}

const validateInputs = (inputs, fieldsFromRule) => {
  for (const input of inputs) {
    const inputFields = Object.keys(input)
    for (const inputField of inputFields) {
      if (!fieldsFromRule.includes(inputField)) {
        throw new UnauthorizedField(inputField)
      }
    }
  }
}

function checkInputFromRuleFields (rule, inputs) {
  const { fields: fieldsFromRule } = rule
  /* istanbul ignore else */
  if (fieldsFromRule) {
    if (!Array.isArray(inputs)) {
      // save
      validateInputs([inputs], fieldsFromRule)
    } else {
      // insert
      validateInputs(inputs, fieldsFromRule)
    }
  }
}

function checkSaveMandatoryFieldsInRules (type, rules) {
  // List of not nullable, not PKs field to validate save/insert when allowed fields are specified on the rule
  const mandatoryFields =
    Object.values(type.fields)
      .filter(k => (!k.isNullable && !k.primaryKey))
      .map(({ camelcase }) => (camelcase))

  for (const rule of rules) {
    const { entity, save } = rule
    if (save && save.fields) {
      const fields = save.fields
      for (const mField of mandatoryFields) {
        if (!fields.includes(mField)) {
          throw new MissingNotNullableError(mField, entity)
        }
      }
    }
  }
}

module.exports = fp(auth)
