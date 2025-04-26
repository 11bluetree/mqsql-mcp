import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import { MySQLDatabase } from "./database/mysql.js";
import { type SchemaInput, schemaTool } from "./tools/schema.js";
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
      const server = new Server({
        name: "MySQL-MCP",
        version: "1.1.1"
      });

      // 利用可能なツールの定義
      const tools = [
        {
          name: "select",
          description:
            "Execute a SELECT SQL query on the MySQL database and return the results. Only SELECT queries are allowed for security reasons.",
          inputSchema: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "SQL SELECT query to execute"
              }
            },
            required: ["query"]
          },
          annotations: {
            title: "Execute SQL SELECT",
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false
          }
        },
        {
          name: "schema",
          description:
            "Get database schema information to understand table structure, column details, and relationships between tables",
          inputSchema: {
            type: "object",
            properties: {
              tableName: {
                type: "string",
                description: "Optional table name to get schema for"
              },
              keyword: {
                type: "string",
                description: "Keyword to search for relevant tables/columns"
              }
            }
          },
          annotations: {
            title: "Database Schema Info",
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false
          }
        }
      ];

      // ツール一覧を返すリクエストハンドラーを設定
      server.setRequestHandler(ListToolsRequestSchema, async () => {
        return { tools };
      });

      // ツール実行リクエストハンドラーを設定
      server.setRequestHandler(CallToolRequestSchema, async (request) => {
        // リクエストからツール名と引数を取得
        const { name, arguments: args } = request.params;

        // SELECTツールの実行
        if (name === "select") {
          const result = await selectTool(this.db, args as SelectInput);

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

        // スキーマツールの実行
        if (name === "schema") {
          const result = await schemaTool(this.db, args as SchemaInput);

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

        // 未知のツール名の場合
        return {
          isError: true,
          content: [{ type: "text", text: `Unknown tool: ${name}` }]
        };
      });

      // 標準入出力用トランスポートを作成
      const transport = new StdioServerTransport();

      // サーバーをトランスポートに接続
      await server.connect(transport);

      console.info(
        'MySQL MCP server is running. Use the "select" tool to execute SQL queries or the "schema" tool to explore database structure.'
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
