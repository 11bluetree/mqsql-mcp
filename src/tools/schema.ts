import { z } from "zod";
import type { MySQLDatabase } from "../database/mysql.js";
import {
  type MCPError,
  createValidationError,
  logError
} from "../utils/error.js";

// スキーマツールの入力パラメータスキーマ
export const SchemaInputSchema = z.object({
  // テーブル名指定（オプション）- 指定しない場合はすべてのテーブル情報を取得
  tableName: z
    .string()
    .optional()
    .describe("Optional table name to get schema for"),
  // キーワードによる検索（オプション）- テーブルやカラム名を検索
  keyword: z
    .string()
    .optional()
    .describe("Keyword to search for relevant tables/columns")
});

// スキーマツールの出力スキーマ
export const SchemaOutputSchema = z.object({
  tables: z.array(
    z.object({
      tableName: z.string(),
      columns: z.array(
        z.object({
          name: z.string(),
          type: z.string(),
          nullable: z.boolean(),
          key: z.string().optional(), // PRI, UNI, MUL など
          default: z.unknown().optional(),
          extra: z.string().optional() // auto_increment など
        })
      )
    })
  ),
  relationships: z
    .array(
      z.object({
        table: z.string(),
        column: z.string(),
        referencedTable: z.string(),
        referencedColumn: z.string(),
        constraintName: z.string()
      })
    )
    .optional()
});

// 入出力の型を定義
export type SchemaInput = z.infer<typeof SchemaInputSchema>;
export type SchemaOutput = z.infer<typeof SchemaOutputSchema>;

/**
 * MySQLデータベースのスキーマ情報を取得するツール
 */
export async function schemaTool(
  db: MySQLDatabase,
  input: SchemaInput
): Promise<MCPError | SchemaOutput> {
  // データベース接続状態を確認
  if (!db.isConnected()) {
    const error = createValidationError("Database is not connected");
    logError(error);
    return error;
  }

  try {
    const result: SchemaOutput = {
      tables: []
    };

    // 1. テーブル一覧を取得
    let tablesQuery = `
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
    `;

    // キーワード検索がある場合
    if (input.keyword) {
      tablesQuery += ` AND TABLE_NAME LIKE '%${input.keyword}%'`;
    }

    // 特定のテーブルが指定されている場合
    if (input.tableName) {
      tablesQuery += ` AND TABLE_NAME = '${input.tableName}'`;
    }

    const tablesResult = await db.executeQuery(tablesQuery);
    if ("type" in tablesResult) {
      logError(tablesResult);
      return tablesResult;
    }

    const tables = tablesResult as { TABLE_NAME: string }[];

    // 2. 各テーブルのカラム情報を取得
    for (const table of tables) {
      const tableName = table.TABLE_NAME;

      const columnsQuery = `
        SELECT 
          COLUMN_NAME as name,
          DATA_TYPE as type,
          IS_NULLABLE as nullable,
          COLUMN_KEY as \`key\`,
          COLUMN_DEFAULT as \`default\`,
          EXTRA as extra
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = '${tableName}'
        ORDER BY ORDINAL_POSITION
      `;

      const columnsResult = await db.executeQuery(columnsQuery);
      if ("type" in columnsResult) {
        logError(columnsResult);
        return columnsResult;
      }

      const columns = columnsResult as {
        name: string;
        type: string;
        nullable: string;
        key?: string;
        default?: unknown;
        extra?: string;
      }[];

      result.tables.push({
        tableName,
        columns: columns.map((col) => ({
          ...col,
          nullable: col.nullable === "YES"
        }))
      });
    }

    // 3. テーブル間の外部キー関係を取得
    const relationshipsQuery = `
      SELECT
        TABLE_NAME as \`table\`,
        COLUMN_NAME as column,
        REFERENCED_TABLE_NAME as referencedTable,
        REFERENCED_COLUMN_NAME as referencedColumn,
        CONSTRAINT_NAME as constraintName
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
      AND REFERENCED_TABLE_SCHEMA = DATABASE()
      AND REFERENCED_TABLE_NAME IS NOT NULL
    `;

    // 特定のテーブルが指定されている場合、そのテーブルの関係だけを取得
    const relationshipFilter = input.tableName
      ? ` AND (TABLE_NAME = '${input.tableName}' OR REFERENCED_TABLE_NAME = '${input.tableName}')`
      : "";

    // キーワード検索がある場合、関連するテーブルもフィルタリング
    const keywordFilter = input.keyword
      ? ` AND (TABLE_NAME LIKE '%${input.keyword}%' OR REFERENCED_TABLE_NAME LIKE '%${input.keyword}%')`
      : "";

    const finalRelationshipsQuery =
      relationshipsQuery + relationshipFilter + keywordFilter;

    const relationshipsResult = await db.executeQuery(finalRelationshipsQuery);
    if (
      !("type" in relationshipsResult) &&
      Array.isArray(relationshipsResult) &&
      relationshipsResult.length > 0
    ) {
      result.relationships = relationshipsResult as {
        table: string;
        column: string;
        referencedTable: string;
        referencedColumn: string;
        constraintName: string;
      }[];
    }

    return result;
  } catch (error) {
    const mcpError = createValidationError(
      `Unexpected error: ${(error as Error).message}`
    );
    logError(mcpError);
    return mcpError;
  }
}
