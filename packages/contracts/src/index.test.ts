import { describe, expect, it } from 'vitest'

import { authorizationEvaluationResponseSchema } from './authorization.js'
import {
  accessEvaluationRequestSchema,
  accessEvaluationResponseSchema,
} from './authzen.js'

const authzenRequest = {
  subject: {
    type: 'user',
    id: 'yuki',
    properties: {
      'cerbos.roles': ['user'],
    },
  },
  action: {
    name: 'update',
  },
  resource: {
    type: 'document',
    id: 'document-123',
    properties: {
      ownerId: 'yuki',
    },
  },
}

describe('accessEvaluationRequestSchema', () => {
  it('accepts Subject, Action and Resource entities', () => {
    expect(
      accessEvaluationRequestSchema.safeParse(authzenRequest).success,
    ).toBe(true)
  })

  it('rejects an incomplete request', () => {
    expect(
      accessEvaluationRequestSchema.safeParse({
        subject: authzenRequest.subject,
        action: authzenRequest.action,
      }).success,
    ).toBe(false)
  })
})

describe('accessEvaluationResponseSchema', () => {
  it('accepts a boolean Decision', () => {
    expect(
      accessEvaluationResponseSchema.safeParse({ decision: true }).success,
    ).toBe(true)
    expect(
      accessEvaluationResponseSchema.safeParse({ decision: false }).success,
    ).toBe(true)
  })

  it('accepts an optional object Context', () => {
    expect(
      accessEvaluationResponseSchema.safeParse({
        decision: false,
        context: {
          reason: 'insufficient_privileges',
        },
      }).success,
    ).toBe(true)
  })

  it('rejects a missing or non-boolean Decision', () => {
    expect(accessEvaluationResponseSchema.safeParse({}).success).toBe(false)
    expect(
      accessEvaluationResponseSchema.safeParse({ decision: 'allow' }).success,
    ).toBe(false)
  })

  it('rejects a non-object Context', () => {
    expect(
      accessEvaluationResponseSchema.safeParse({
        decision: true,
        context: 'unexpected',
      }).success,
    ).toBe(false)
  })
})

describe('authorizationEvaluationResponseSchema', () => {
  it('accepts an ALLOW response with a simulated operation', () => {
    expect(
      authorizationEvaluationResponseSchema.safeParse({
        decision: 'ALLOW',
        requestId: 'request-allow',
        authzenRequest,
        authzenResponse: {
          decision: true,
        },
        simulatedOperation: {
          subject: 'yuki',
          action: 'update',
          resource: 'document-123',
          status: 'simulated',
        },
      }).success,
    ).toBe(true)
  })

  it('accepts DENY and NOT_EVALUATED responses', () => {
    expect(
      authorizationEvaluationResponseSchema.safeParse({
        decision: 'DENY',
        requestId: 'request-deny',
        authzenRequest,
        authzenResponse: {
          decision: false,
        },
      }).success,
    ).toBe(true)

    expect(
      authorizationEvaluationResponseSchema.safeParse({
        decision: 'NOT_EVALUATED',
        reason: 'PDP_UNAVAILABLE',
        requestId: 'request-error',
        authzenRequest,
      }).success,
    ).toBe(true)
  })

  it('rejects a Decision that conflicts with the PDP response', () => {
    expect(
      authorizationEvaluationResponseSchema.safeParse({
        decision: 'ALLOW',
        requestId: 'request-invalid',
        authzenRequest,
        authzenResponse: {
          decision: false,
        },
        simulatedOperation: {
          subject: 'yuki',
          action: 'update',
          resource: 'document-123',
          status: 'simulated',
        },
      }).success,
    ).toBe(false)
  })

  it('rejects NOT_EVALUATED when a PDP response is fabricated', () => {
    expect(
      authorizationEvaluationResponseSchema.safeParse({
        decision: 'NOT_EVALUATED',
        reason: 'PDP_UNAVAILABLE',
        requestId: 'request-error',
        authzenRequest,
        authzenResponse: {
          decision: false,
        },
      }).success,
    ).toBe(false)
  })
})
