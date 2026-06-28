# 推奨コミットメッセージ（2026-06-28）

## 結論

推奨コミットメッセージは次です。

```text
feat: clarify daily learning automation and scan workflow
```

## 理由

- 日次学習を毎日9:00に自動実行する設定を明確にしました。
- `learn:daily` を無料データと6時間足で実行する形にしました。
- 学習記録欄に自動学習の状態、時刻、時間足、データ元を表示しました。
- 全体スキャンの役割説明を画面に追加しました。
- 変更は4ファイル、新規レポートは1ファイルです。

## 詳細版

```text
feat: clarify daily learning automation and scan workflow

- run daily learning with free data across 6 intervals
- show auto learning schedule status in the app
- explain the purpose of the full market scan view
- save the daily learning and scan explanation report
```

## 次のアクション

1. 上の推奨メッセージでコミットする。
2. コミット対象に `reports/daily-learning-and-scan-explanation-2026-06-28.md` も含める。
3. コミット後に `git push origin main` を実行する。
