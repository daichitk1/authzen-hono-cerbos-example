import type {
  AccessEvaluationRequest,
  AccessEvaluationResponse,
} from '@authzen-demo/contracts'
import type {
  DemoDocument,
  DemoSubject,
  DemoSubjectId,
  DocumentAction,
} from '@authzen-demo/domain'

// authorizeDocumentが具体的なAuthZEN通信実装へ直接依存しないための境界。
// Testでは同じ形のFake Clientへ差し替えて、PEPのDecision強制だけを確認できる。
export type AuthorizationClient = {
  evaluate(
    request: AccessEvaluationRequest,
    requestId: string,
  ): Promise<AccessEvaluationResponse>
}

type SimulationInput = {
  subject: DemoSubjectId
  action: DocumentAction
  resource: string
}

type SimulatedOperation = SimulationInput & {
  status: 'simulated'
}

export type SimulateOperation = (input: SimulationInput) => SimulatedOperation

// ALLOW後に、実際にPDPへ送ったRequestとResponseをUIへ見せるためのTrace。
export type AuthorizationTrace = {
  requestId: string
  request: AccessEvaluationRequest
  response: AccessEvaluationResponse
}

// Hono Contextを、認証 → Resource取得 → 認可 → Handlerの順に受け渡す値。
export type AppEnv = {
  Variables: {
    currentUser: DemoSubject
    document: DemoDocument
    documentAction: DocumentAction
    authorizationTrace: AuthorizationTrace
  }
}

export type CreateAppOptions = {
  authorizationClient?: AuthorizationClient
  requestIdFactory?: () => string
  simulateOperation?: SimulateOperation
}
