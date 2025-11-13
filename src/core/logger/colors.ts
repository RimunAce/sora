export const red = (text: string): string => `\x1b[31m${text}\x1b[0m`

export const green = (text: string): string => `\x1b[32m${text}\x1b[0m`

export const yellow = (text: string): string => `\x1b[33m${text}\x1b[0m`

export const blue = (text: string): string => `\x1b[34m${text}\x1b[0m`

export const magenta = (text: string): string => `\x1b[35m${text}\x1b[0m`

export const cyan = (text: string): string => `\x1b[36m${text}\x1b[0m`

export const white = (text: string): string => `\x1b[37m${text}\x1b[0m`

export const gray = (text: string): string => `\x1b[90m${text}\x1b[0m`

export const bright = (text: string): string => `\x1b[1m${text}\x1b[0m`