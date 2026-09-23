import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'ja-JP',
  title: 'AuthZEN Hono Cerbos Example',
  description:
    'Hono、AuthZEN、Cerbosを使った認可デモの要件・設計・コードガイド',
  base: '/authzen-hono-cerbos-example/',
  themeConfig: {
    nav: [
      { text: '概要', link: '/' },
      { text: '要件', link: '/requirements' },
      { text: '設計', link: '/design' },
      { text: 'コードガイド', link: '/learning/README' },
    ],
    sidebar: [
      { text: '概要', link: '/' },
      { text: '要件定義', link: '/requirements' },
      { text: '設計', link: '/design' },
      { text: 'ReactとHonoのAPI', link: '/api/frontend-api' },
      { text: '信頼境界', link: '/security/boundaries' },
      { text: 'コードを読む順番', link: '/learning/README' },
      { text: 'コード解説', link: '/learning/repository-learning-guide' },
    ],
    search: { provider: 'local' },
  },
})
