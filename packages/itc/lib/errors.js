import createError from '@fastify/error'

export const ERROR_PREFIX = 'PLT_ITC'

export const HandlerFailed = createError(`${ERROR_PREFIX}_HANDLER_FAILED`, 'Handler failed with error: %s')
export const HandlerNotFound = createError(`${ERROR_PREFIX}_HANDLER_NOT_FOUND`, 'Handler not found for request: "%s"')
export const PortAlreadyListening = createError(`${ERROR_PREFIX}_ALREADY_LISTENING`, 'ITC is already listening')
export const SendBeforeListen = createError(
  `${ERROR_PREFIX}_SEND_BEFORE_LISTEN`,
  'ITC cannot send requests before listening'
)
export const InvalidRequestVersion = createError(
  `${ERROR_PREFIX}_INVALID_REQUEST_VERSION`,
  'Invalid ITC request version: "%s"'
)
export const InvalidResponseVersion = createError(
  `${ERROR_PREFIX}_INVALID_RESPONSE_VERSION`,
  'Invalid ITC response version: "%s"'
)
export const MissingRequestName = createError(`${ERROR_PREFIX}_MISSING_REQUEST_NAME`, 'ITC request name is missing')
export const MissingResponseName = createError(`${ERROR_PREFIX}_MISSING_RESPONSE_NAME`, 'ITC response name is missing')
export const MissingRequestReqId = createError(`${ERROR_PREFIX}_MISSING_REQUEST_REQ_ID`, 'ITC request reqId is missing')
export const MissingResponseReqId = createError(
  `${ERROR_PREFIX}_MISSING_RESPONSE_REQ_ID`,
  'ITC response reqId is missing'
)
export const RequestNameIsNotString = createError(
  `${ERROR_PREFIX}_REQUEST_NAME_IS_NOT_STRING`,
  'ITC request name is not a string: "%s"'
)
export const MessagePortClosed = createError(`${ERROR_PREFIX}_MESSAGE_PORT_CLOSED`, 'ITC MessagePort is closed')
export const MissingName = createError(`${ERROR_PREFIX}_MISSING_NAME`, 'ITC name is missing')
