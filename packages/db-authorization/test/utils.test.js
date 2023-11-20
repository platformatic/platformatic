'use strict'
const { test } = require('node:test')
const { tspl } = require('@matteo.collina/tspl')
const { getRequestFromContext, getRoles } = require('../lib/utils')

const ANONYMOUS_ROLE = 'anonymous'
test('should extract request from context', (t) => {
  const { equal } = tspl(t, { plan: 1 })
  const fakeContext = {
    reply: {
      request: 'hooray'
    }
  }
  const res = getRequestFromContext(fakeContext)
  equal(res, 'hooray')
})

test('should throw', (t) => {
  const { throws } = tspl(t, { plan: 2 })
  throws(() => {
    getRequestFromContext()
  })

  throws(() => {
    getRequestFromContext({
      noReplyHere: true
    })
  })
})

test('should get roles from user', (t) => {
  const { deepEqual } = tspl(t, { plan: 4 })
  const roleKey = 'role'
  {
    const requestWithNoUser = {}
    deepEqual(getRoles(requestWithNoUser, roleKey, ANONYMOUS_ROLE), [ANONYMOUS_ROLE])
  }
  {
    const requestWithStringRoles = {
      user: {
        [roleKey]: 'role1,role2,role3'
      }
    }
    deepEqual(getRoles(requestWithStringRoles, roleKey, ANONYMOUS_ROLE), ['role1', 'role2', 'role3'])
  }
  {
    const requestWithArrayRoles = {
      user: {
        [roleKey]: ['role1', 'role2', 'role3']
      }
    }
    deepEqual(getRoles(requestWithArrayRoles, roleKey, ANONYMOUS_ROLE), ['role1', 'role2', 'role3'])
  }
  {
    const requestWithOtherKindOfRole = {
      user: {
        [roleKey]: { role1: true, role2: true }
      }
    }
    deepEqual(getRoles(requestWithOtherKindOfRole, roleKey, ANONYMOUS_ROLE), [ANONYMOUS_ROLE])
  }
})
