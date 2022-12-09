import chalk, { supportsColor } from 'chalk'
const useColor = supportsColor && !process.env.NO_COLOR
const noop = (str) => str
export const pltGreen = useColor ? chalk.hex('#21FA90') : noop
