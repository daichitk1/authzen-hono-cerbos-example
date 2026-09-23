import {
  accessEvaluationResponseSchema,
  type AccessEvaluationRequest,
  type AccessEvaluationResponse,
} from '@authzen-demo/contracts'

import { createAuthZenClientError, type AuthZenClientError } from './errors.js'

const DEFAULT_TIMEOUT_MS = 1500

type AuthZenClientOptions = {
  readonly baseUrl: string
  readonly timeoutMs?: number
  readonly fetch?: typeof fetch
}

const normalizeBaseUrl = (baseUrl: string): string => {
  const normalized = baseUrl.trim().replace(/\/+$/, '')

  if (normalized.length === 0) {
    throw new TypeError('AuthZEN PDP base URL must not be empty')
  }

  return normalized
}

const isAbortError = (value: unknown): boolean => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    value.name === 'AbortError'
  )
}

const classifyFailure = (
  error: unknown,
  signal: AbortSignal,
  timeoutMs: number,
  fallbackCode: 'NETWORK_ERROR' | 'INVALID_JSON',
  fallbackMessage: string,
): AuthZenClientError => {
  if (signal.aborted || isAbortError(error)) {
    return createAuthZenClientError(
      'TIMEOUT',
      `PDP request timed out after ${timeoutMs}ms`,
      { cause: error },
    )
  }

  return createAuthZenClientError(fallbackCode, fallbackMessage, {
    cause: error,
  })
}

const postAccessEvaluation = async (
  fetchImpl: typeof fetch,
  baseUrl: string,
  request: AccessEvaluationRequest,
  requestId: string,
  signal: AbortSignal,
  timeoutMs: number,
): Promise<Response> => {
  try {
    return await fetchImpl(`${baseUrl}/access/v1/evaluation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // PEP側のRequest IDをHeaderへ載せる。Cerbos内部ログへの反映は未検証。
        'X-Request-ID': requestId,
      },
      body: JSON.stringify(request),
      signal,
    })
  } catch (error) {
    throw classifyFailure(
      error,
      signal,
      timeoutMs,
      'NETWORK_ERROR',
      'PDP request failed before receiving an HTTP response',
    )
  }
}

const assertSuccessfulResponse = (response: Response): void => {
  if (!response.ok) {
    throw createAuthZenClientError(
      'HTTP_ERROR',
      `PDP returned HTTP ${response.status}`,
      { status: response.status },
    )
  }
}

const parseAccessEvaluationResponse = async (
  response: Response,
  signal: AbortSignal,
  timeoutMs: number,
): Promise<AccessEvaluationResponse> => {
  let payload: unknown

  try {
    payload = await response.json()
  } catch (error) {
    throw classifyFailure(
      error,
      signal,
      timeoutMs,
      'INVALID_JSON',
      'PDP returned invalid JSON',
    )
  }

  // PDPは外部Systemなので、TypeScriptの型だけでは信用せずZodで検証する。
  const result = accessEvaluationResponseSchema.safeParse(payload)

  if (!result.success) {
    throw createAuthZenClientError(
      'INVALID_RESPONSE',
      'PDP returned a payload without a valid boolean Decision',
      { cause: result.error },
    )
  }

  return result.data
}

// Hono(PEP)とCerbos(PDP)の間のAuthZEN通信だけを担当する境界。
// 「誰を許可するか」というPolicy判断はここでは行わない。
export const createAuthZenClient = ({
  baseUrl,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetch: fetchImpl = globalThis.fetch,
}: AuthZenClientOptions) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new TypeError('AuthZEN PDP timeout must be a positive number')
  }

  const normalizedBaseUrl = normalizeBaseUrl(baseUrl)

  const evaluate = async (
    request: AccessEvaluationRequest,
    requestId: string,
  ): Promise<AccessEvaluationResponse> => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await postAccessEvaluation(
        fetchImpl,
        normalizedBaseUrl,
        request,
        requestId,
        controller.signal,
        timeoutMs,
      )

      // non-2xxはPolicy DENYではなく、PDP APIとの通信・処理上の失敗として扱う。
      // Policy DENYは通常の2xx Response内の decision: false として後段で受け取る。
      assertSuccessfulResponse(response)

      return await parseAccessEvaluationResponse(
        response,
        controller.signal,
        timeoutMs,
      )
    } finally {
      clearTimeout(timeout)
    }
  }

  return { evaluate }
}
