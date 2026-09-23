import {
  authorizationEvaluationResponseSchema,
  type AuthorizationEvaluationResponse,
} from '@authzen-demo/contracts'
import type { DemoSubjectId, DocumentAction } from '@authzen-demo/domain'

type EvaluateAccessInput = {
  subjectId: DemoSubjectId
  documentId: string
  action: DocumentAction
}

export type EvaluationResult = {
  httpStatus: number
  body: AuthorizationEvaluationResponse
}

export type EvaluateAccess = (
  input: EvaluateAccessInput,
) => Promise<EvaluationResult>

type EvaluationApiErrorCode =
  'INVALID_JSON' | 'INVALID_RESPONSE' | 'NETWORK_ERROR' | 'UNEXPECTED_STATUS'

type EvaluationApiErrorOptions = {
  cause?: unknown
  httpStatus?: number
}

export type EvaluationApiError = Error & {
  readonly name: 'EvaluationApiError'
  readonly code: EvaluationApiErrorCode
  readonly httpStatus: number | undefined
}

const createEvaluationApiError = (
  code: EvaluationApiErrorCode,
  message: string,
  options: EvaluationApiErrorOptions = {},
): EvaluationApiError => {
  const error = new Error(
    message,
    options.cause === undefined ? undefined : { cause: options.cause },
  )

  return Object.assign(error, {
    name: 'EvaluationApiError' as const,
    code,
    httpStatus: options.httpStatus,
  })
}

export const isEvaluationApiError = (
  value: unknown,
): value is EvaluationApiError => {
  return (
    value instanceof Error &&
    value.name === 'EvaluationApiError' &&
    'code' in value &&
    typeof value.code === 'string' &&
    'httpStatus' in value
  )
}

type CreateEvaluateAccessOptions = {
  baseUrl?: string
  fetch?: typeof fetch
}

const expectedStatusForDecision = (
  decision: AuthorizationEvaluationResponse['decision'],
): number => {
  if (decision === 'ALLOW') {
    return 200
  }

  if (decision === 'DENY') {
    return 403
  }

  return 503
}

const normalizeBaseUrl = (baseUrl: string | undefined): string => {
  return (baseUrl ?? '').trim().replace(/\/+$/, '')
}

export const createEvaluateAccess = ({
  baseUrl,
  fetch: fetchImpl = globalThis.fetch,
}: CreateEvaluateAccessOptions = {}): EvaluateAccess => {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl)

  return async ({ subjectId, documentId, action }) => {
    const url = `${normalizedBaseUrl}/api/demo/documents/${encodeURIComponent(documentId)}/actions/${encodeURIComponent(action)}`
    let response: Response

    try {
      response = await fetchImpl(url, {
        method: 'POST',
        headers: {
          'X-Demo-Subject': subjectId,
        },
      })
    } catch (error) {
      throw createEvaluationApiError(
        'NETWORK_ERROR',
        'Authorization API request failed before receiving a response',
        { cause: error },
      )
    }

    let body: unknown

    try {
      body = await response.json()
    } catch (error) {
      throw createEvaluationApiError(
        'INVALID_JSON',
        'Authorization API returned invalid JSON',
        {
          cause: error,
          httpStatus: response.status,
        },
      )
    }

    const parsed = authorizationEvaluationResponseSchema.safeParse(body)
    if (!parsed.success) {
      throw createEvaluationApiError(
        'INVALID_RESPONSE',
        'Authorization API returned a payload outside the response contract',
        { httpStatus: response.status },
      )
    }

    const expectedStatus = expectedStatusForDecision(parsed.data.decision)
    if (response.status !== expectedStatus) {
      throw createEvaluationApiError(
        'UNEXPECTED_STATUS',
        `Authorization API returned HTTP ${response.status} for ${parsed.data.decision}`,
        { httpStatus: response.status },
      )
    }

    return {
      httpStatus: response.status,
      body: parsed.data,
    }
  }
}

export const evaluateAccess = createEvaluateAccess({
  baseUrl: import.meta.env.VITE_API_BASE_URL,
})
