export function waitFor<T>(value: T, ms = 250): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(value), ms)
  })
}
