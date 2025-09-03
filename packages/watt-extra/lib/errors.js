import createError from '@fastify/error'

// Compliancy errors
const CompliancyMetadataError = createError('PLT_COMPLIANCE_METADATA_ERROR', 'Failed to send compliancy metadata')
const CompliancyStatusError = createError('PLT_COMPLIANCE_STATUS_ERROR', 'Failed to get compliance status')

// Application errors
const ApplicationNotFoundError = createError('PLT_APPLICATION_NOT_FOUND_ERROR', 'Application not found')
const ApplicationInfoError = createError('PLT_APPLICATION_INFO_ERROR', 'Failed to get application info')

// Metadata errors
const MetadataRuntimeError = createError('PLT_METADATA_RUNTIME_ERROR', 'Failed in getting and processing runtime metadata')
const MetadataError = createError('PLT_METADATA_ERROR', 'Failure in metadata processing')
const MetadataStateError = createError('PLT_METADATA_STATE_ERROR', 'Failed to save application state to Control Plane')
const MetadataAppIdError = createError('PLT_METADATA_APPID_ERROR', 'Cannot process metadata: no applicationId available')
const MetadataRuntimeNotStartedError = createError('PLT_METADATA_RUNTIME_NOT_STARTED_ERROR', 'Cannot process metadata: runtime not started')

// Status errors
const StatusSendError = createError('PLT_STATUS_SEND_ERROR', 'Failed to send application status')
const StatusAppIdError = createError('PLT_STATUS_APPID_ERROR', 'Cannot send application status: no applicationId available')

export {
  CompliancyMetadataError,
  CompliancyStatusError,
  ApplicationNotFoundError,
  ApplicationInfoError,
  MetadataRuntimeError,
  MetadataError,
  MetadataStateError,
  MetadataAppIdError,
  MetadataRuntimeNotStartedError,
  StatusSendError,
  StatusAppIdError
}
