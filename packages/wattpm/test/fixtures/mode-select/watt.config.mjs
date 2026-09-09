/*
  Reports which env-file set the mode selected, through a setting whose value survives unchanged.
  `.env.staging` is only read when the mode is staging, so startTimeout says which happened, and
  messagingTimeout says what the context reported — the two have to agree.
*/
export default ctx => ({
  applications: [],
  logger: { level: 'fatal' },
  startTimeout: Number(process.env.SELECTED ?? 1),
  messagingTimeout: ctx.mode === 'staging' ? 11111 : 22222
})
