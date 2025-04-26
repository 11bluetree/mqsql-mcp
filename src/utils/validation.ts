/**
 * SQLクエリが安全なSELECTクエリであるか検証する
 * @param query 検証するSQLクエリ
 * @returns 検証結果と可能なエラーメッセージ
 */
export function validateSelectQuery(query: string): {
  valid: boolean;
  message?: string;
} {
  // クエリを正規化（トリミング、大文字小文字区別なし）
  const normalizedQuery = query.trim().toLowerCase();

  // SELECTで始まるクエリのみ許可
  if (!normalizedQuery.startsWith("select")) {
    return { valid: false, message: "Only SELECT queries are allowed" };
  }

  // 危険な操作を含むクエリをブロック
  const dangerousKeywords = [
    "insert",
    "update",
    "delete",
    "drop",
    "alter",
    "create",
    "truncate",
    "rename",
    "replace",
    "grant",
    "revoke",
    "shutdown",
    "process",
    ";",
    "into outfile",
    "into dumpfile",
  ];

  for (const keyword of dangerousKeywords) {
    // 単語の境界をチェック（例: 'select' が 'selection' の一部でないことを確認）
    const regex = new RegExp(`\\b${keyword}\\b`, "i");
    if (regex.test(normalizedQuery)) {
      return {
        valid: false,
        message: `Query contains forbidden keyword: ${keyword}`,
      };
    }
  }

  // 複数のステートメントをチェック（セミコロンの存在）
  if (normalizedQuery.includes(";")) {
    return { valid: false, message: "Multiple SQL statements are not allowed" };
  }

  return { valid: true };
}
