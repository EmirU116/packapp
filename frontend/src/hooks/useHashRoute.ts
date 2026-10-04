import { useSyncExternalStore } from 'react'

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

/**
 * The current page name, taken from the address after "#/".
 *
 * `#/search` → "search". Links are plain `<a href="#/search">`, so the
 * browser's back button and reload work without a routing library.
 */
export function useHashRoute(): string {
  return useSyncExternalStore(subscribe, () => window.location.hash.replace(/^#\/?/, ''))
}
