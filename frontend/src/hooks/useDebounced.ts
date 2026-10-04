import { useEffect, useState } from 'react'

/**
 * A copy of `value` that only changes once `value` has been stable for
 * `delay` ms – so typing in a search box does not fire a request per key.
 */
export function useDebounced<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}
