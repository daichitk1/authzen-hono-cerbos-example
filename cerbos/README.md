# Cerbos

`conf.yaml`でPDPを設定し、`policies/document.yaml`でDocumentの権限を定義します。`policies/document_test.yaml`はPolicyの確認用です。

Repositoryのルートで`pnpm cerbos:up`を実行すると、ローカルのCerbosにPolicyが読み込まれます。`pnpm cerbos:compile`でPolicyを検証できます。
