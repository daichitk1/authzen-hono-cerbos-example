// AuthZENのActionとしてPDPへ送れる値をServer側で固定する。
// URLから受け取った任意文字列をそのまま認可判断へ使わないためのallowlistでもある。
export const documentActions = ['read', 'update', 'delete'] as const

export type DocumentAction = (typeof documentActions)[number]

export const isDocumentAction = (value: string): value is DocumentAction => {
  return documentActions.includes(value as DocumentAction)
}

// DemoではClientからSubject IDだけを受け取り、RoleはこのServer-side recordから解決する。
// 本番ではSession / JWT / OIDC / DBなど、検証済みの認証情報へ置き換える想定。
export const demoSubjects = [
  {
    id: 'yuki',
    displayName: 'Yuki',
    roles: ['user'],
    relation: 'owner',
  },
  {
    id: 'ren',
    displayName: 'Ren',
    roles: ['user'],
    relation: 'non-owner',
  },
  {
    id: 'admin',
    displayName: 'Admin',
    roles: ['admin'],
    relation: 'administrator',
  },
] as const

export type DemoSubject = (typeof demoSubjects)[number]
export type DemoSubjectId = DemoSubject['id']

export const findDemoSubject = (id: string): DemoSubject | undefined => {
  return demoSubjects.find((subject) => subject.id === id)
}

// ownerIdはCerbosのOwner判定に使う重要なResource属性。
// ClientのRequest Bodyではなく、Server-sideのResource情報を正として扱う。
export const demoDocument = {
  type: 'document',
  id: 'document-123',
  ownerId: 'yuki',
} as const

export type DemoDocument = typeof demoDocument

export const findDemoDocument = (id: string): DemoDocument | undefined => {
  return id === demoDocument.id ? demoDocument : undefined
}
