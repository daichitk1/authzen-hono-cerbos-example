export type AuthZenClientErrorCode =
  | 'HTTP_ERROR'
  | 'INVALID_JSON'
  | 'INVALID_RESPONSE'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'

type AuthZenClientErrorOptions = Readonly<{
  status?: number
  cause?: unknown
}>

export type AuthZenClientError = Error & {
  readonly name: 'AuthZenClientError'
  readonly code: AuthZenClientErrorCode
  readonly status: number | undefined
}

export const createAuthZenClientError = (
  code: AuthZenClientErrorCode,
  message: string,
  options: AuthZenClientErrorOptions = {},
): AuthZenClientError => {
  const error = new Error(
    message,
    options.cause === undefined ? undefined : { cause: options.cause },
  )

  return Object.assign(error, {
    name: 'AuthZenClientError' as const,
    code,
    status: options.status,
  })
}

export const isAuthZenClientError = (
  value: unknown,
): value is AuthZenClientError => {
  return (
    value instanceof Error &&
    value.name === 'AuthZenClientError' &&
    'code' in value &&
    typeof value.code === 'string' &&
    'status' in value
  )
}
