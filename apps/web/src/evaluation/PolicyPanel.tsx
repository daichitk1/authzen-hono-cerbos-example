import type { ReactNode } from 'react'

import type { MatchingRule } from './presentation.js'

export type PolicyPanelProps = {
  hasPolicyDecision: boolean
  matchingRule: MatchingRule
}

type PolicyRuleProps = {
  children: ReactNode
  hasPolicyDecision: boolean
  isDenyRule?: boolean
  isMatch: boolean
  testId: string
}

const PolicyRule = ({
  children,
  hasPolicyDecision,
  isDenyRule = false,
  isMatch,
  testId,
}: PolicyRuleProps) => {
  const className = [
    hasPolicyDecision && isMatch ? 'is-match' : '',
    isDenyRule ? 'is-deny-rule' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <li className={className} data-testid={testId}>
      <div className="rule-body">{children}</div>
      {hasPolicyDecision && isMatch ? (
        <span className="match-label">この判定に対応</span>
      ) : null}
    </li>
  )
}

export const PolicyPanel = ({
  hasPolicyDecision,
  matchingRule,
}: PolicyPanelProps) => {
  return (
    <section className="policy-panel" aria-labelledby="policy-heading">
      <header className="section-heading">
        <h2 id="policy-heading">許可される条件</h2>
        <p>次の条件にひとつでも当てはまる場合だけ、操作を許可します。</p>
      </header>

      <ul aria-label="許可される条件" className="policy-rule-list">
        <PolicyRule
          hasPolicyDecision={hasPolicyDecision}
          isMatch={matchingRule === 'read_document'}
          testId="policy-rule-read"
        >
          <strong>文書を閲覧する</strong>
          <p>一般ユーザーと管理者は閲覧できます。</p>
        </PolicyRule>
        <PolicyRule
          hasPolicyDecision={hasPolicyDecision}
          isMatch={matchingRule === 'owner_can_modify_document'}
          testId="policy-rule-owner"
        >
          <strong>自分の文書を編集・削除する</strong>
          <p>一般ユーザーは、自分が所有する文書だけ編集・削除できます。</p>
        </PolicyRule>
        <PolicyRule
          hasPolicyDecision={hasPolicyDecision}
          isMatch={matchingRule === 'admin_can_modify_document'}
          testId="policy-rule-admin"
        >
          <strong>管理者が編集・削除する</strong>
          <p>管理者は、所有者に関係なく文書を編集・削除できます。</p>
        </PolicyRule>
        <PolicyRule
          hasPolicyDecision={hasPolicyDecision}
          isDenyRule
          isMatch={matchingRule === null}
          testId="policy-rule-default-deny"
        >
          <strong>上記に当てはまらない</strong>
          <p>明示的な許可がない場合は、安全のため拒否します。</p>
        </PolicyRule>
      </ul>
    </section>
  )
}
