import createError from '@fastify/error'

export const InvalidSkillFileError = createError('PLT_INVALID_SKILL_FILE', 'Invalid bundled skill file: %s')
export const SkillFileNotFoundError = createError('PLT_SKILL_FILE_NOT_FOUND', 'Bundled skill file not found: %s')
