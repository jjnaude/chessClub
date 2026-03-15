import { useEffect, useState } from 'react'

export function usePageQuery<T>(fetcher: () => Promise<T>) {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<T | null>(null)

  useEffect(() => {
    let mounted = true

    fetcher()
      .then((result) => {
        if (!mounted) return
        setData(result)
        setError(null)
      })
      .catch(() => {
        if (!mounted) return
        setError('Unable to load page data. Please refresh and try again.')
      })
      .finally(() => {
        if (!mounted) return
        setIsLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [fetcher])

  return { isLoading, error, data }
}
