# 画面のScreenshot

`pnpm test:e2e`を実行すると、Playwrightがこのディレクトリに初期画面、ALLOW、DENY、PDP障害時の画像を生成します。画像はGit管理せず、CIでは`authorization-evidence`というArtifactに14日間保存します。

Screenshotは表示の確認用です。認可結果の検証は`tests/`と`cerbos/policies/document_test.yaml`を参照してください。
