'use strict'

const createError = require('@fastify/error')

const ERROR_PREFIX = 'PLT_ITC'

module.exports = {
  HandlerFailed: createError(
    `${ERROR_PREFIX}_HANDLER_FAILED`,
    'Handler failed with error: %s'
  ),
  HandlerNotFound: createError(
    `${ERROR_PREFIX}_HANDLER_NOT_FOUND`,
    'Handler not found for request: "%s"'
  ),
  PortAlreadyListening: createError(
    `${ERROR_PREFIX}_ALREADY_LISTENING`,
    'ITC is already listening'
  ),
  SendBeforeListen: createError(
    `${ERROR_PREFIX}_SEND_BEFORE_LISTEN`,
    'ITC cannot send requests before listening'
  ),
  InvalidRequestVersion: createError(
    `${ERROR_PREFIX}_INVALID_REQUEST_VERSION`,
    'Invalid ITC request version: "%s"'
  ),
  InvalidResponseVersion: createError(
    `${ERROR_PREFIX}_INVALID_RESPONSE_VERSION`,
    'Invalid ITC response version: "%s"'
  ),
  MissingRequestName: createError(
    `${ERROR_PREFIX}_MISSING_REQUEST_NAME`,
    'ITC request name is missing'
  ),
  MissingResponseName: createError(
    `${ERROR_PREFIX}_MISSING_RESPONSE_NAME`,
    'ITC response name is missing'
  ),
  MissingRequestReqId: createError(
    `${ERROR_PREFIX}_MISSING_REQUEST_REQ_ID`,
    'ITC request reqId is missing'
  ),
  MissingResponseReqId: createError(
    `${ERROR_PREFIX}_MISSING_RESPONSE_REQ_ID`,
    'ITC response reqId is missing'
  ),
  RequestNameIsNotString: createError(
    `${ERROR_PREFIX}_REQUEST_NAME_IS_NOT_STRING`,
    'ITC request name is not a string: "%s"'
  ),
  MessagePortClosed: createError(
    `${ERROR_PREFIX}_MESSAGE_PORT_CLOSED`,
    'ITC MessagePort is closed'
  ),
}
