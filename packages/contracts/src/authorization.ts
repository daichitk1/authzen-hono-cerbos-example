import { z } from 'zod'

import {
  accessEvaluationRequestSchema,
  accessEvaluationResponseSchema,
} from './authzen.js'

const simulatedOperationResponseSchema = z.object({
  subject: z.string(),
  action: z.string(),
  resource: z.string(),
  status: z.literal('simulated'),
})

const authorizationAllowResponseSchema = z.object({
  decision: z.literal('ALLOW'),
  requestId: z.string(),
  authzenRequest: accessEvaluationRequestSchema,
  authzenResponse: accessEvaluationResponseSchema.extend({
    decision: z.literal(true),
  }),
  simulatedOperation: simulatedOperationResponseSchema,
})

const authorizationDenyResponseSchema = z.object({
  decision: z.literal('DENY'),
  requestId: z.string(),
  authzenRequest: accessEvaluationRequestSchema,
  authzenResponse: accessEvaluationResponseSchema.extend({
    decision: z.literal(false),
  }),
})

const authorizationNotEvaluatedResponseSchema = z.object({
  decision: z.literal('NOT_EVALUATED'),
  reason: z.literal('PDP_UNAVAILABLE'),
  requestId: z.string(),
  authzenRequest: accessEvaluationRequestSchema,
  // NOT_EVALUATEDではPDP Decisionが存在しないため、authzenResponseを持たせない。
  authzenResponse: z.never().optional(),
})

export const authorizationEvaluationResponseSchema = z.discriminatedUnion(
  'decision',
  [
    authorizationAllowResponseSchema,
    authorizationDenyResponseSchema,
    authorizationNotEvaluatedResponseSchema,
  ],
)

export type AuthorizationEvaluationResponse = z.infer<
  typeof authorizationEvaluationResponseSchema
>
