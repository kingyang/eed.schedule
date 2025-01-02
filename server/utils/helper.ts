export function nanoid(t = 8) {
  return crypto.getRandomValues(new Uint8Array(t)).reduce(
    (t, e) => (t

            += (e &= 63) < 36
        ? e.toString(36)
        : e < 62
          ? (e - 26).toString(36).toUpperCase()
          : e > 62
            ? '-'
            : '_'),
    '',
  )
}

export function delay(t: number) {
  return new Promise(resolve => setTimeout(resolve, t))
}

export const isEmpty = (obj: any) => [Array, Object].includes((obj || {}).constructor) && !Object.entries((obj || {})).length

export function reduce(
  input: any,
  iteratee: (accumulator: any, value: any, key: number | string) => any,
  accumulator: any,
): any {
  if (Array.isArray(input)) {
    for (let i = 0; i < input.length; i++)
      accumulator = iteratee(accumulator, input[i], i)
  }
  else {
    for (const key in input) {
      if (Object.prototype.hasOwnProperty.call(input, key))
        accumulator = iteratee(accumulator, input[key], key)
    }
  }
  // 返回累积值
  return accumulator
}

export function each(input: any, callback: (value: any, key: number | string) => void): void {
  if (Array.isArray(input)) {
    for (let i = 0; i < input.length; i++)
      callback(input[i], i)
  }
  else {
    for (const key in input) {
      if (Object.prototype.hasOwnProperty.call(input, key))
        callback(input[key], key)
    }
  }
}
