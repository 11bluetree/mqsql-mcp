import { z } from "zod";
import type { MySQLDatabase } from "../database/mysql";
import { type MCPError, createValidationError, logError } from "../utils/error";
import { validateSelectQuery } from "../utils/validation";

// SELECTツールの入力パラメータスキーマ
export const SelectInputSchema = z.object({
  query: z.string().describe("SQL SELECT query to execute")
});

// SELECTツールの出力スキーマ
export const SelectOutputSchema = z.array(z.record(z.any()));

// 入出力の型を定義
export type SelectInput = z.infer<typeof SelectInputSchema>;
export type SelectOutput = z.infer<typeof SelectOutputSchema>;

/**
 * MySQLデータベースにSELECTクエリを実行するツール
 */
export async function selectTool(
  db: MySQLDatabase,
  input: SelectInput
): Promise<MCPError | Record<string, any>[]> {
  // クエリが安全なSELECTクエリであるか検証
  const validation = validateSelectQuery(input.query);
  if (!validation.valid) {
    const error = createValidationError(
      validation.message || "Invalid SQL query"
    );
    logError(error);
    return error;
  }

  // データベース接続状態を確認
  if (!db.isConnected()) {
    const error = createValidationError("Database is not connected");
    logError(error);
    return error;
  }

  try {
    // クエリを実行
    const result = await db.executeQuery(input.query);

    // エラーの場合はそのまま返す
    if ("type" in result) {
      logError(result);
      return result;
    }

    // 結果が配列形式でない場合（OkPacket等）は空の配列を返す
    if (!Array.isArray(result)) {
      return [];
    }

    // 結果をJSON形式で返す（Record<string, any>[]型に変換）
    return result as Record<string, any>[];
  } catch (error) {
    const mcpError = createValidationError(
      `Unexpected error: ${(error as Error).message}`
    );
    logError(mcpError);
    return mcpError;
  }
}
