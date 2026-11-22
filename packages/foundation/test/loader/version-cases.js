// Shared expectations for the independent runtime bootstrap and capability version policies.
export const versionCases = [
  ['4.0.0', '4.0.0', ['ok', 'ok', 'ok']],
  ['4.0.0+one', '4.0.0+two', ['ok', 'ok', 'ok']],
  ['4.0.0', '4.0.1', ['ok', 'warning', 'error']],
  ['4.0.0', '4.1.0', ['warning', 'warning', 'error']],
  ['4.0.0', '5.0.0', ['error', 'error', 'error']],
  ['4.0.0', '5.0.0-alpha.1', ['error', 'error', 'error']],
  ['4.0.0', '4.0.0-alpha.1', ['error', 'warning', 'error']],
  ['4.0.0-alpha.1', '4.0.0-alpha.2', ['error', 'warning', 'error']],
  ['4.0.0-alpha.1+one', '4.0.0-alpha.1+two', ['ok', 'ok', 'ok']],
  [undefined, '4.0.0', ['ok', 'ok', 'ok']],
  ['invalid', '4.0.0', ['ok', 'ok', 'ok']]
]
