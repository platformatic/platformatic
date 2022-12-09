'use strict'

const fp = require('fastify-plugin')
const leven = require('leven')

const findRule = require('./lib/find-rule')
const { getRequestFromContext, getRoles } = require('./lib/utils')
const {
  Unauthorized,
  UnauthorizedField,
  MissingNotNullableError
} = require('./lib/errors')

const PLT_ADMIN_ROLE = 'platformatic-admin'

async function auth (app, opts) {
  if (opts.jwt) {
    await app.register(require('./lib/jwt'), opts.jwt)
  }

  if (opts.webhook) {
    await app.register(require('./lib/webhook'), opts.webhook)
  }

  if (opts.jwt && opts.webhook) {
    app.decorateRequest('createSession', async function () {
      try {
        // `createSession` actually exists only if jwt or webhook are enabled
        // and creates a new `request.user` object
        await this.createJWTSession()
      } catch (err) {
        this.log.trace({ err })

        await this.createWebhookSession()
      }
    })
  } else if (opts.jwt) {
    app.decorateRequest('createSession', function () {
      return this.createJWTSession()
    })
  } else if (opts.webhook) {
    app.decorateRequest('createSession', function () {
      return this.createWebhookSession()
    })
  }

  const adminSecret = opts.adminSecret
  const roleKey = opts.roleKey || 'X-PLATFORMATIC-ROLE'
  const anonymousRole = opts.anonymousRole || 'anonymous'

  app.decorateRequest('setupDBAuthorizationUser', setupUser)

  async function setupUser () {
    if (this.user) {
      return
    }

    const request = this

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

    if (typeof request.createSession === 'function') {
      try {
        // `createSession` actually exists only if jwt or webhook are enabled
        // and creates a new `request.user` object
        await request.createSession()
        request.log.debug({ user: request.user }, 'logged user in')
      } catch (err) {
        request.log.trace({ err })
      }
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
    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i]
      if (!app.platformatic.entities[rule.entity]) {
        // There is a unknown entity. Let's find out the nearest one for a nice error message
        const entities = Object.keys(app.platformatic.entities)
        const nearest = entities.reduce((acc, entity) => {
          const distance = leven(rule.entity, entity)
          if (distance < acc.distance) {
            acc.distance = distance
            acc.entity = entity
          }
          return acc
        }, { distance: Infinity, entity: null })
        throw new Error(`Unknown entity '${rule.entity}' in authorization rule ${i}. Did you mean '${nearest.entity}'?`)
      }
      if (!entityRules[rule.entity]) {
        entityRules[rule.entity] = []
      }
      entityRules[rule.entity].push(rule)
    }

    for (const entityKey of Object.keys(app.platformatic.entities)) {
      const rules = entityRules[entityKey] || []
      const type = app.platformatic.entities[entityKey]

      // We have subscriptions!
      let userPropToFillForPublish
      let topicsWithoutChecks = false
      if (app.platformatic.mq) {
        for (const rule of rules) {
          const checks = rule.find?.checks
          if (typeof checks !== 'object') {
            topicsWithoutChecks = !!rule.find
            continue
          }
          const keys = Object.keys(checks)
          if (keys.length !== 1) {
            throw new Error(`Subscription requires that the role "${rule.role}" has only one check in the find rule for entity "${rule.entity}"`)
          }
          const key = keys[0]

          const val = typeof checks[key] === 'object' ? checks[key].eq : checks[key]
          if (userPropToFillForPublish && userPropToFillForPublish.val !== val) {
            throw new Error('Unable to configure subscriptions and authorization due to multiple check clauses in find')
          }
          userPropToFillForPublish = { key, val }
        }
      }

      if (userPropToFillForPublish && topicsWithoutChecks) {
        throw new Error(`Subscription for entity "${entityKey}" have conflictling rules across roles`)
      }

      // MUST set this after doing the security checks on the subscriptions
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

      app.platformatic.addEntityHooks(entityKey, {
        async find (originalFind, { where, ctx, fields, skipAuth, ...restOpts } = {}) {
          if (skipAuth || !ctx) {
            return originalFind({ ...restOpts, where, ctx, fields })
          }
          const request = getRequestFromContext(ctx)
          const rule = await findRuleForRequestUser(ctx, rules, roleKey, anonymousRole)
          checkFieldsFromRule(rule.find, fields || Object.keys(app.platformatic.entities[entityKey].fields))
          where = await fromRuleToWhere(ctx, rule.find, where, request.user)

          return originalFind({ ...restOpts, where, ctx, fields })
        },

        async save (originalSave, { input, ctx, fields, skipAuth }) {
          if (skipAuth || !ctx) {
            return originalSave({ input, ctx, fields })
          }
          const request = getRequestFromContext(ctx)
          const rule = await findRuleForRequestUser(ctx, rules, roleKey, anonymousRole)

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

          let hasAllPrimaryKeys = false
          const whereConditions = {}
          for (const key of type.primaryKeys) {
            hasAllPrimaryKeys = hasAllPrimaryKeys || input[key] !== undefined
            whereConditions[key] = { eq: input[key] }
          }

          if (hasAllPrimaryKeys) {
            const where = await fromRuleToWhere(ctx, rule.save, whereConditions, request.user)

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

        async insert (originalInsert, { inputs, ctx, fields, skipAuth }) {
          if (skipAuth || !ctx) {
            return originalInsert({ inputs, ctx, fields })
          }
          const request = getRequestFromContext(ctx)
          const rule = await findRuleForRequestUser(ctx, rules, roleKey, anonymousRole)

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

        async delete (originalDelete, { where, ctx, fields, skipAuth }) {
          if (skipAuth || !ctx) {
            return originalDelete({ where, ctx, fields })
          }
          const request = getRequestFromContext(ctx)
          const rule = await findRuleForRequestUser(ctx, rules, roleKey, anonymousRole)

          where = await fromRuleToWhere(ctx, rule.delete, where, request.user)

          return originalDelete({ where, ctx, fields })
        },

        async updateMany (originalUpdateMany, { where, ctx, fields, skipAuth, ...restOpts }) {
          if (skipAuth || !ctx) {
            return originalUpdateMany({ ...restOpts, where, ctx, fields })
          }
          const request = getRequestFromContext(ctx)
          const rule = await findRuleForRequestUser(ctx, rules, roleKey, anonymousRole)

          where = await fromRuleToWhere(ctx, rule.updateMany, where, request.user)

          return originalUpdateMany({ ...restOpts, where, ctx, fields })
        },

        async getPublishTopic (original, opts) {
          const request = opts.ctx.reply.request
          const originalTopic = await original(opts)
          if (userPropToFillForPublish) {
            return `/${userPropToFillForPublish.key}/${request.user[userPropToFillForPublish.val]}${originalTopic}`
          }
          return originalTopic
        },

        async getSubscriptionTopic (original, opts) {
          const { ctx } = opts
          const request = getRequestFromContext(ctx)
          await request.setupDBAuthorizationUser()

          // TODO make sure anonymous users cannot subscribe

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

async function findRuleForRequestUser (ctx, rules, roleKey, anonymousRole) {
  const request = getRequestFromContext(ctx)
  await request.setupDBAuthorizationUser()
  const roles = getRoles(request, roleKey, anonymousRole)
  const rule = findRule(rules, roles)
  if (!rule) {
    ctx.reply.request.log.warn({ roles, rules }, 'no rule for roles')
    throw new Unauthorized()
  }
  ctx.reply.request.log.trace({ roles, rule }, 'found rule')
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
