import { z } from "zod";
import { MySQLDatabase } from "../database/mysql";
import { validateSelectQuery } from "../utils/validation";
import { MCPError, createValidationError, logError } from "../utils/error";

// SELECTツールの入力パラメータスキーマ
export const SelectInputSchema = z.object({
  query: z.string().describe("SQL SELECT query to execute"),
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
): Promise<SelectOutput | MCPError> {
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

    // 結果をJSON形式で返す
    return result;
  } catch (error) {
    const mcpError = createValidationError(
      `Unexpected error: ${(error as Error).message}`
    );
    logError(mcpError);
    return mcpError;
  }
}
