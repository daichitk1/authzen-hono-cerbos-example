import { z } from 'zod'

const propertiesSchema = z.record(z.string(), z.unknown())

// SubjectとResourceはAuthZEN上で同じ基本形を持つ。
// propertiesにはRoleやownerIdなど、PDPが判断に使う追加属性を載せられる。
const authZenEntitySchema = z.object({
  type: z.string(),
  id: z.string(),
  properties: propertiesSchema.optional(),
})

const authZenActionSchema = z.object({
  name: z.string(),
  properties: propertiesSchema.optional(),
})

// PEP(Hono)からPDP(Cerbos)へ送るsingle Access EvaluationのRequest。
// subject / action / resourceが「誰が・何を・何に対して」を表す。
export const accessEvaluationRequestSchema = z.object({
  subject: authZenEntitySchema,
  action: authZenActionSchema,
  resource: authZenEntitySchema,
  context: propertiesSchema.optional(),
})

export type AccessEvaluationRequest = z.infer<
  typeof accessEvaluationRequestSchema
>

// decisionはPolicy評価が完了した結果。falseも正常な認可判断であり、通信Errorではない。
export const accessEvaluationResponseSchema = z.object({
  decision: z.boolean(),
  context: propertiesSchema.optional(),
})

export type AccessEvaluationResponse = z.infer<
  typeof accessEvaluationResponseSchema
>
