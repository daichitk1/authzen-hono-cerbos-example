import { describe, expect, it } from 'vitest'

import {
  demoDocument,
  demoSubjects,
  documentActions,
  findDemoDocument,
  findDemoSubject,
  isDocumentAction,
} from './index.js'

describe('demo domain foundation', () => {
  it('keeps the resource owner and subjects deterministic', () => {
    expect(demoDocument.ownerId).toBe('yuki')
    expect(demoSubjects.map((subject) => subject.id)).toEqual([
      'yuki',
      'ren',
      'admin',
    ])
  })

  it('limits the initial action vocabulary', () => {
    expect(documentActions).toEqual(['read', 'update', 'delete'])
    expect(isDocumentAction('update')).toBe(true)
    expect(isDocumentAction('become-admin')).toBe(false)
  })

  it('resolves only fixed server-side subjects and documents', () => {
    expect(findDemoSubject('ren')).toEqual(
      expect.objectContaining({
        id: 'ren',
        roles: ['user'],
      }),
    )
    expect(findDemoSubject('unknown')).toBeUndefined()
    expect(findDemoDocument('document-123')).toBe(demoDocument)
    expect(findDemoDocument('unknown')).toBeUndefined()
  })
})
