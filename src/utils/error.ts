// エラータイプの定義
export enum ErrorType {
  VALIDATION_ERROR = "VALIDATION_ERROR",
  DATABASE_CONNECTION_ERROR = "DATABASE_CONNECTION_ERROR",
  QUERY_EXECUTION_ERROR = "QUERY_EXECUTION_ERROR",
  INTERNAL_ERROR = "INTERNAL_ERROR"
}

// MCPツールのエラー形式
export interface MCPError {
  type: ErrorType;
  message: string;
  details?: unknown;
}

/**
 * バリデーションエラーを作成
 */
export function createValidationError(message: string): MCPError {
  return {
    type: ErrorType.VALIDATION_ERROR,
    message
  };
}

/**
 * データベース接続エラーを作成
 */
export function createDatabaseConnectionError(
  message: string,
  details?: unknown
): MCPError {
  return {
    type: ErrorType.DATABASE_CONNECTION_ERROR,
    message,
    details
  };
}

/**
 * クエリ実行エラーを作成
 */
export function createQueryExecutionError(
  message: string,
  details?: unknown
): MCPError {
  return {
    type: ErrorType.QUERY_EXECUTION_ERROR,
    message,
    details
  };
}

/**
 * エラーを標準エラー出力に記録
 */
export function logError(error: MCPError): void {
  console.error(`[${error.type}] ${error.message}`);
  if (error.details) {
    console.error("Details:", error.details);
  }
}
