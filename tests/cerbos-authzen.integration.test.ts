import { accessEvaluationResponseSchema } from '../packages/contracts/src/authzen.js'
import { describe, expect, it } from 'vitest'

const pdpBaseUrl = process.env.PDP_BASE_URL ?? 'http://127.0.0.1:3592'

type EvaluationCase = {
  name: string
  subjectId: 'yuki' | 'ren' | 'admin'
  role: 'user' | 'admin'
  action: string
  expectedDecision: boolean
}

const evaluationCases: EvaluationCase[] = [
  {
    name: 'allows Yuki to read the Document',
    subjectId: 'yuki',
    role: 'user',
    action: 'read',
    expectedDecision: true,
  },
  {
    name: 'allows Yuki to update the owned Document',
    subjectId: 'yuki',
    role: 'user',
    action: 'update',
    expectedDecision: true,
  },
  {
    name: 'denies Ren from updating another user Document',
    subjectId: 'ren',
    role: 'user',
    action: 'update',
    expectedDecision: false,
  },
  {
    name: 'denies Ren from deleting another user Document',
    subjectId: 'ren',
    role: 'user',
    action: 'delete',
    expectedDecision: false,
  },
  {
    name: 'allows Admin to update the Document',
    subjectId: 'admin',
    role: 'admin',
    action: 'update',
    expectedDecision: true,
  },
  {
    name: 'allows Admin to delete the Document',
    subjectId: 'admin',
    role: 'admin',
    action: 'delete',
    expectedDecision: true,
  },
  {
    name: 'denies an unknown action by default',
    subjectId: 'yuki',
    role: 'user',
    action: 'unknown',
    expectedDecision: false,
  },
]

const evaluate = async ({
  subjectId,
  role,
  action,
}: EvaluationCase): Promise<boolean> => {
  const requestId = `cerbos-policy-test-${subjectId}-${action}`
  const response = await fetch(`${pdpBaseUrl}/access/v1/evaluation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Request-ID': requestId,
    },
    body: JSON.stringify({
      subject: {
        type: 'user',
        id: subjectId,
        properties: {
          'cerbos.roles': [role],
        },
      },
      action: {
        name: action,
      },
      resource: {
        type: 'document',
        id: 'document-123',
        properties: {
          ownerId: 'yuki',
        },
      },
    }),
  })

  const body: unknown = await response.json()

  if (!response.ok) {
    throw new Error(
      `Cerbos returned HTTP ${response.status}: ${JSON.stringify(body)}`,
    )
  }

  const parsed = accessEvaluationResponseSchema.safeParse(body)
  if (!parsed.success) {
    throw new Error(
      `Cerbos returned an invalid payload: ${JSON.stringify(body)}`,
    )
  }

  return parsed.data.decision
}

describe('Cerbos AuthZEN Document policy', () => {
  it.each(evaluationCases)('$name', async (testCase) => {
    await expect(evaluate(testCase)).resolves.toBe(testCase.expectedDecision)
  })
})
