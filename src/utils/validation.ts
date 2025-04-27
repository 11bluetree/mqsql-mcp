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

  // 複数のステートメントをチェック（セミコロンの存在）
  if (normalizedQuery.includes(";")) {
    return { valid: false, message: "Multiple SQL statements are not allowed" };
  }

  // 文字列リテラルを一時的に置き換えてからキーワードチェックを行う
  const literalPlaceholders: string[] = [];
  const queryWithoutLiterals = normalizedQuery.replace(
    /'([^']*)'|"([^"]*)"/g,
    (match) => {
      literalPlaceholders.push(match);
      return `__LITERAL_${literalPlaceholders.length - 1}__`;
    }
  );

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
    "into outfile",
    "into dumpfile"
  ];

  for (const keyword of dangerousKeywords) {
    // 単語の境界をチェック（例: 'select' が 'selection' の一部でないことを確認）
    const regex = new RegExp(`\\b${keyword}\\b`, "i");
    if (regex.test(queryWithoutLiterals)) {
      return {
        valid: false,
        message: `Query contains forbidden keyword: ${keyword}`
      };
    }
  }

  const dangerousFunctions = [
    "sleep",
    "benchmark",
    "load_file",
    "load data",
    "sys_eval",
    "extractvalue",
    "updatexml"
  ];

  for (const func of dangerousFunctions) {
    const regex = new RegExp(`\\b${func.replace(/[()]/g, "\\$&")}\\b`, "i");
    if (regex.test(normalizedQuery)) {
      return {
        valid: false,
        message: `Query contains dangerous function: ${func}`
      };
    }
  }

  // SQLインジェクションで典型的に使われるパターンをチェック
  const suspiciousPatterns = [
    /\bor\s+['"]?\s*['"]?\s*(=|is)\s*['"]?\s*['"]?/i, // OR '=' ', OR = などのパターン
    /\bor\s+['"]?[0-9]+['"]?\s*(=|is)\s*['"]?[0-9]+['"]?/i, // OR 1=1 などのパターン
    /\band\s+['"]?[0-9]+['"]?\s*(=|is)\s*['"]?[0-9]+['"]?/i, // AND 1=1 などのパターン
    /--/, // SQLコメント
    /\/\*/, // ブロックコメント開始
    /\*\// // ブロックコメント終了
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(normalizedQuery)) {
      return {
        valid: false,
        message: "Query contains potential SQL injection pattern"
      };
    }
  }

  return { valid: true };
}
