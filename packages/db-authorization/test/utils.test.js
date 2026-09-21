import { deepEqual, equal, throws } from 'node:assert'
import { test } from 'node:test'
import { getRequestFromContext, getRoles } from '../lib/utils.js'

const ANONYMOUS_ROLE = 'anonymous'
test('should extract request from context', t => {
  const fakeContext = {
    reply: {
      request: 'hooray'
    }
  }
  const res = getRequestFromContext(fakeContext)
  equal(res, 'hooray')
})

test('should throw', t => {
  throws(() => {
    getRequestFromContext()
  })

  throws(() => {
    getRequestFromContext({
      noReplyHere: true
    })
  })
})

test('should get roles from user', t => {
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

test('should get roles from user with path', t => {
  const roleKey = 'role'
  const isRolePath = true
  {
    const requestWithNoUser = {}
    deepEqual(getRoles(requestWithNoUser, roleKey, ANONYMOUS_ROLE, isRolePath), [ANONYMOUS_ROLE])
  }
  {
    // Past is set, but it is not a path
    const requestWithStringRoles = {
      user: {
        [roleKey]: 'role1,role2,role3'
      }
    }
    deepEqual(getRoles(requestWithStringRoles, roleKey, ANONYMOUS_ROLE, isRolePath), ['role1', 'role2', 'role3'])
  }

  {
    // Proper path with array
    const roleKey = 'resource_access.rest-api.roles'
    // Past is set, but it is not a path
    const requestWithStringRoles = {
      user: {
        resource_access: {
          'rest-api': {
            roles: ['role1', 'role2', 'role3']
          }
        }
      }
    }
    deepEqual(getRoles(requestWithStringRoles, roleKey, ANONYMOUS_ROLE, isRolePath), ['role1', 'role2', 'role3'])
  }

  {
    // Proper path with comma separated string
    const roleKey = 'resource_access.rest-api.roles'
    // Past is set, but it is not a path
    const requestWithStringRoles = {
      user: {
        resource_access: {
          'rest-api': {
            roles: 'role1,role2,role3'
          }
        }
      }
    }
    deepEqual(getRoles(requestWithStringRoles, roleKey, ANONYMOUS_ROLE, isRolePath), ['role1', 'role2', 'role3'])
  }

  {
    // Malformed path should not throw and should fall back to anonymous
    const roleKey = 'resource_access.rest-api.roles'
    const requestWithMalformedPath = {
      user: {
        resource_access: null
      }
    }
    deepEqual(getRoles(requestWithMalformedPath, roleKey, ANONYMOUS_ROLE, isRolePath), [ANONYMOUS_ROLE])
  }

  {
    // Primitive intermediate value should not throw and should fall back to anonymous
    const roleKey = 'resource_access.rest-api.roles'
    const requestWithPrimitiveInPath = {
      user: {
        resource_access: {
          'rest-api': 'admin'
        }
      }
    }
    deepEqual(getRoles(requestWithPrimitiveInPath, roleKey, ANONYMOUS_ROLE, isRolePath), [ANONYMOUS_ROLE])
  }
})
