# GitHub CLI インストール記録 2026-06-26

## 結論
GitHub CLI を1件インストールしました。

## 理由
`winget install --id GitHub.cli --source winget` が成功しました。

確認できたバージョンは以下です。

```text
gh version 2.95.0 (2026-06-17)
https://github.com/cli/cli/releases/tag/v2.95.0
```

## 補足
現在のPowerShellでは `gh` がまだPATHに反映されていません。
実体は以下にあります。

```text
C:\Program Files\GitHub CLI\gh.exe
```

新しいターミナルを開くと `gh --version` で使える可能性があります。
