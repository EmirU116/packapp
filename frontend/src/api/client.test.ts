import { expect, test, vi } from 'vitest'
import { api, ApiError } from './client'

function respondWith(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response(body === null ? null : JSON.stringify(body), { status })),
  )
}

test('returns the JSON body on success', async () => {
  respondWith(200, { id: 1 })
  await expect(api('/api/x')).resolves.toEqual({ id: 1 })
})

test('sends a JSON body with the request', async () => {
  respondWith(201, {})
  await api('/api/x', { method: 'POST', body: { a: 1 } })
  expect(fetch).toHaveBeenCalledWith(
    '/api/x',
    expect.objectContaining({ method: 'POST', body: '{"a":1}' }),
  )
})

test('handles an empty 204 answer', async () => {
  respondWith(204, null)
  await expect(api('/api/x', { method: 'DELETE' })).resolves.toBeNull()
})

test('uses the backend message for plain errors', async () => {
  respondWith(401, { detail: 'Wrong username or password' })
  await expect(api('/api/x')).rejects.toMatchObject({ status: 401, message: 'Wrong username or password' })
})

test('names the field in validation errors', async () => {
  respondWith(422, {
    detail: [
      { loc: ['body', 'email'], msg: 'Value error, Not a valid email address' },
      { loc: ['body'], msg: 'Value error, Give a recipient' },
    ],
  })
  await expect(api('/api/x')).rejects.toMatchObject({
    message: 'email: Not a valid email address. Give a recipient',
  })
})

test('explains when the server cannot be reached', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
  await expect(api('/api/x')).rejects.toBeInstanceOf(ApiError)
  await expect(api('/api/x')).rejects.toMatchObject({ message: expect.stringContaining('Cannot reach') })
})
