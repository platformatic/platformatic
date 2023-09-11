'use strict'

const AuthSchema = {
  $id: '/BasegraphAuth',
  type: 'object',
  properties: {
    adminSecret: {
      type: 'string',
      description: 'The password should be used to access routes under /_admin prefix.'
    }
  },
  additionalProperties: true // TODO remove and add proper validation for the rules
}

module.exports = AuthSchema
