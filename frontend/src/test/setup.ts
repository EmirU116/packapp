import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Remove rendered components and reset mocks between tests
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
