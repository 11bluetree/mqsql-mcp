import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { MySQLDatabase } from "./database/mysql.js";
import { type SelectInput, selectTool } from "./tools/select.js";
import {
  type DatabaseConfig,
  getDatabaseConfig,
  validateDatabaseConfig
} from "./utils/config.js";

export class MySQLMCPServer {
  private db: MySQLDatabase;
  private config: DatabaseConfig;

  constructor() {
    // 環境変数から設定を取得
    this.config = getDatabaseConfig();
    // データベース接続クラスの初期化
    this.db = new MySQLDatabase(this.config);
  }

  /**
   * サーバーを起動
   */
  async start(): Promise<void> {
    try {
      // 設定値の検証
      const configError = validateDatabaseConfig(this.config);
      if (configError) {
        console.error(`Configuration error: ${configError}`);
        process.exit(1);
      }

      // データベースに接続
      const connectionResult = await this.db.connect();
      if (connectionResult && "type" in connectionResult) {
        console.error(`Database connection error: ${connectionResult.message}`);
        process.exit(1);
      }

      // MCPサーバーを作成し、サーバー情報を設定
      const server = new McpServer({
        name: "MySQL-MCP",
        version: "1.0.0"
      });

      // SELECTツールを登録
      server.tool(
        "select",
        "Execute a SELECT SQL query on the MySQL database and return the results. Only SELECT queries are allowed for security reasons.",
        {
          query: z.string().describe("SQL SELECT query to execute")
        },
        async (args: SelectInput) => {
          const result = await selectTool(this.db, args);

          // エラーの場合
          if ("type" in result) {
            return {
              content: [{ type: "text", text: result.message }],
              isError: true
            };
          }

          // 正常な結果の場合
          return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
          };
        }
      );

      // 標準入出力用トランスポートを作成
      const transport = new StdioServerTransport();

      // サーバーをトランスポートに接続
      await server.connect(transport);

      console.info(
        'MySQL MCP server is running. Use the "select" tool to execute SQL queries.'
      );

      // プロセス終了時の処理
      process.on("SIGINT", this.shutdown.bind(this));
      process.on("SIGTERM", this.shutdown.bind(this));
    } catch (error) {
      console.error("Failed to start server:", (error as Error).message);
      await this.db.disconnect();
      process.exit(1);
    }
  }

  /**
   * サーバーをシャットダウン
   */
  async shutdown(): Promise<void> {
    console.info("Shutting down MySQL MCP server...");
    await this.db.disconnect();
    process.exit(0);
  }
}
