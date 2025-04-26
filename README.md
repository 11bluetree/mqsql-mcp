# MySQL MCP Server

MySQL用のModel Context Protocol (MCP) サーバー。SELECTクエリの実行に特化しています。

## 特徴

- TypeScriptで実装
- MySQLへの接続とSELECTクエリの実行
- クエリ結果をJSON形式で返却
- セキュリティのためSELECT文のみに制限
- 環境変数による接続設定

## 必要条件

- Node.js
- MySQL/MariaDBデータベース

## インストールと使い方

```bash
# パッケージをインストール
npm install

# ビルド
npm run build

# 実行
npx -y mysql-client

# または環境変数を設定して実行
MYSQL_HOST=localhost MYSQL_PORT=3306 MYSQL_USER=root MYSQL_PASSWORD=password MYSQL_DATABASE=test npx -y mysql-client
```

## 提供ツール

- `select`: SELECT SQLクエリを実行し、結果をJSON形式で返します

## セキュリティ注意事項

このMCPサーバーは、セキュリティ上の理由からSELECTクエリのみを許可しています。データ変更操作（INSERT、UPDATE、DELETE等）は実行できません。
