'use strict'
const { test } = require('tap')
const { getRequestFromContext, getRoles } = require('../lib/utils')

const ANONYMOUS_ROLE = 'anonymous'
test('should extract request from context', ({ equal, plan }) => {
  plan(1)
  const fakeContext = {
    reply: {
      request: 'hooray'
    }
  }
  const res = getRequestFromContext(fakeContext)
  equal(res, 'hooray')
})

test('should throw', ({ throws, plan }) => {
  plan(2)
  throws(() => {
    getRequestFromContext()
  })

  throws(() => {
    getRequestFromContext({
      noReplyHere: true
    })
  })
})

test('should get roles from user', ({ same, plan }) => {
  plan(4)
  const roleKey = 'role'
  {
    const requestWithNoUser = {}
    same(getRoles(requestWithNoUser, roleKey, ANONYMOUS_ROLE), [ANONYMOUS_ROLE])
  }
  {
    const requestWithStringRoles = {
      user: {
        [roleKey]: 'role1,role2,role3'
      }
    }
    same(getRoles(requestWithStringRoles, roleKey, ANONYMOUS_ROLE), ['role1', 'role2', 'role3'])
  }
  {
    const requestWithArrayRoles = {
      user: {
        [roleKey]: ['role1', 'role2', 'role3']
      }
    }
    same(getRoles(requestWithArrayRoles, roleKey, ANONYMOUS_ROLE), ['role1', 'role2', 'role3'])
  }
  {
    const requestWithOtherKindOfRole = {
      user: {
        [roleKey]: { role1: true, role2: true }
      }
    }
    same(getRoles(requestWithOtherKindOfRole, roleKey, ANONYMOUS_ROLE), [ANONYMOUS_ROLE])
  }
})
