/** An error answer from the backend, with a message that can be shown to the user. */
export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

interface ValidationIssue {
  loc: (string | number)[]
  msg: string
}

/**
 * Turn a FastAPI error body into one readable sentence.
 *
 * `detail` is either a plain string (our own errors) or a list of
 * validation issues, each pointing at the field that is wrong.
 */
function errorMessage(body: unknown, fallback: string): string {
  const detail = (body as { detail?: string | ValidationIssue[] } | null)?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail
      .map((issue) => {
        // loc is e.g. ["body", "email"]; the last part names the field
        const field = issue.loc.at(-1)
        const message = issue.msg.replace(/^Value error, /, '')
        return typeof field === 'string' && field !== 'body' ? `${field}: ${message}` : message
      })
      .join('. ')
  }
  return fallback
}

/**
 * Call the backend API.
 *
 * Sends and receives JSON, includes the login cookie, and throws an
 * `ApiError` for any non-2xx answer or when the server cannot be reached.
 */
export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      method: options.method ?? 'GET',
      credentials: 'same-origin',
      headers: options.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Is the backend running?')
  }

  // 204 No Content has no body to parse
  const body = response.status === 204 ? null : await response.json().catch(() => null)
  if (!response.ok) {
    throw new ApiError(response.status, errorMessage(body, `Request failed (${response.status})`))
  }
  return body as T
}
