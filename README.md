# MySQL MCP Server

MySQL用のModel Context Protocol (MCP) サーバー。SELECTクエリの実行とデータベーススキーマの取得に対応しています。

## 特徴

- TypeScriptで実装
- MySQLへの接続とSELECTクエリの実行
- データベースのスキーマ情報（テーブル構造、列情報、リレーションシップ）の取得
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
- `schema`: データベースのスキーマ情報を取得し、テーブル構造、カラム情報、テーブル間の関係を返します

## セキュリティ注意事項

このMCPサーバーは、セキュリティ上の理由からSELECTクエリのみを許可しています。データ変更操作（INSERT、UPDATE、DELETE等）は実行できません。

## VS CodeでのMCP設定

### ワークスペースでの設定

1. VS Codeのワークスペースで、`.vscode/mcp.json`ファイルを作成します
2. 以下のような設定を追加します：

```json
{
  "inputs": [
    {
      "type": "promptString",
      "id": "mysql-password",
      "description": "MySQLパスワード",
      "password": true
    }
  ],
  "servers": {
    "mysql-mcp-server": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "mysql-mcp@1.1.1"
      ],
      "env": {
        "MYSQL_HOST": "localhost",
        "MYSQL_PORT": "3306",
        "MYSQL_DATABASE": "データベース名",
        "MYSQL_USER": "ユーザー名",
        "MYSQL_PASSWORD": "${input:mysql-password}"
      }
    }
  }
}
```

### ユーザー設定での設定

すべてのワークスペースでMCPサーバーを利用するには、VS Codeのユーザー設定に追加します：

1. コマンドパレット（`Ctrl+Shift+P` または `Cmd+Shift+P`）を開き、`MCP: Add Server`を選択します
2. サーバー情報を入力し、`User Settings`を選択して追加します
3. または、`settings.json`に直接追加することもできます：

```json
{
  "mcp": {
    "servers": {
      "mysql-mcp-server": {
        "type": "stdio",
        "command": "npx",
        "args": [
          "-y",
          "mysql-mcp@1.1.1"
        ],
        "env": {
          "MYSQL_HOST": "localhost",
          "MYSQL_PORT": "3306",
          "MYSQL_DATABASE": "データベース名",
          "MYSQL_USER": "ユーザー名",
          "MYSQL_PASSWORD": "パスワード"
        }
      }
    }
  }
}
```

### MCPサーバーの利用方法

1. VS Codeでチャットビュー（`Ctrl+Alt+I`）を開きます
2. ドロップダウンから`Agent`モードを選択します
3. `Tools`ボタンをクリックして利用可能なツールを確認します
4. チャットでSQLクエリやデータベーススキーマについて質問すると、`select`や`schema`ツールが自動的に呼び出されます

### MCPサーバーの管理

- コマンドパレットから`MCP: List Servers`を実行するとMCPサーバーの一覧が表示されます
- サーバーの起動、停止、再起動、設定の確認、ログの表示ができます
