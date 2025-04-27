import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  jest,
  test
} from "@jest/globals";
import type { QueryResult, RowDataPacket } from "mysql2/promise";
import type { MySQLDatabase } from "../../database/mysql.js";
import type { DatabaseConfig } from "../../utils/config.js";
import type { MCPError } from "../../utils/error.js";
import { ErrorType } from "../../utils/error.js";
import * as ErrorModule from "../../utils/error.js";
import { validateSelectQuery } from "../../utils/validation.js";
import * as ValidationModule from "../../utils/validation.js";
import { type SelectInput, selectTool } from "../select.js";

function createMockDatabase(): jest.Mocked<MySQLDatabase> {
  const dbConfig: DatabaseConfig = {
    host: "localhost",
    port: 3306,
    database: "test_db",
    user: "root",
    password: "password"
  };

  return {
    dbConfig,
    connection: null,

    connect: jest
      .fn<() => Promise<MCPError | undefined>>()
      .mockResolvedValue(undefined),
    disconnect: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    executeQuery: jest
      .fn<(query: string) => Promise<MCPError | QueryResult | QueryResult[]>>()
      .mockResolvedValue([] as QueryResult[]),
    isConnected: jest.fn<() => boolean>().mockReturnValue(true)
  } as unknown as jest.Mocked<MySQLDatabase>;
}

const mockErrorType = ErrorType;
jest.mock("../../utils/error.js", () => ({
  ErrorType: {
    VALIDATION_ERROR: "VALIDATION_ERROR",
    DATABASE_CONNECTION_ERROR: "DATABASE_CONNECTION_ERROR",
    QUERY_EXECUTION_ERROR: "QUERY_EXECUTION_ERROR",
    INTERNAL_ERROR: "INTERNAL_ERROR"
  },
  logError: jest.fn(),
  createValidationError: jest.fn((message) => ({
    type: "VALIDATION_ERROR",
    message
  }))
}));

describe("selectTool", () => {
  let mockDb: jest.Mocked<MySQLDatabase>;
  const defaultQuery = "SELECT * FROM users";

  beforeAll(() => {
    jest.spyOn(ValidationModule, "validateSelectQuery");
    jest.spyOn(ErrorModule, "logError");
  });

  beforeEach(() => {
    mockDb = createMockDatabase();
    jest.clearAllMocks();
  });

  test("正常系、クエリ結果が返される", async () => {
    const mockData = [
      { id: 1, name: "Test User 1" },
      { id: 2, name: "Test User 2" }
    ] as RowDataPacket[];
    mockDb.executeQuery.mockResolvedValueOnce(
      mockData as unknown as QueryResult
    );
    const input: SelectInput = { query: defaultQuery };

    const result = await selectTool(mockDb, input);

    expect(validateSelectQuery).toHaveBeenCalledWith(input.query);
    expect(mockDb.isConnected).toHaveBeenCalled();
    expect(mockDb.executeQuery).toHaveBeenCalledWith(input.query);
    expect(result).toEqual(mockData);
  });

  test("データベース接続がない場合はエラー", async () => {
    mockDb.isConnected.mockReturnValueOnce(false);
    const input: SelectInput = { query: defaultQuery };

    const result = await selectTool(mockDb, input);

    expect(mockDb.isConnected).toHaveBeenCalled();
    expect(mockDb.executeQuery).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        type: mockErrorType.VALIDATION_ERROR,
        message: "Database is not connected"
      })
    );
    expect(ErrorModule.logError).toHaveBeenCalled();
  });

  test("存在しないテーブルに対するクエリ実行時にエラー", async () => {
    const dbError: MCPError = {
      type: mockErrorType.QUERY_EXECUTION_ERROR,
      message: "テーブルが存在しません"
    };
    mockDb.executeQuery.mockResolvedValueOnce(dbError);
    const input: SelectInput = { query: "SELECT * FROM nonexistent_table" };

    const result = await selectTool(mockDb, input);

    expect(mockDb.executeQuery).toHaveBeenCalledWith(input.query);
    expect(result).toEqual(dbError);
    expect(ErrorModule.logError).toHaveBeenCalled();
  });

  test("データベース接続エラー発生時エラー", async () => {
    const dbError: MCPError = {
      type: mockErrorType.DATABASE_CONNECTION_ERROR,
      message: "データベース接続エラー"
    };
    mockDb.executeQuery.mockResolvedValueOnce(dbError);
    const input: SelectInput = { query: defaultQuery };

    const result = await selectTool(mockDb, input);

    expect(mockDb.executeQuery).toHaveBeenCalledWith(input.query);
    expect(result).toEqual(dbError);
    expect(ErrorModule.logError).toHaveBeenCalled();
  });

  test("クエリ実行時のSQL構文エラー", async () => {
    const dbError: MCPError = {
      type: mockErrorType.QUERY_EXECUTION_ERROR,
      message: "クエリ実行エラー",
      details: { code: "ER_SYNTAX_ERROR" }
    };
    mockDb.executeQuery.mockResolvedValueOnce(dbError);
    const input: SelectInput = { query: defaultQuery };

    const result = await selectTool(mockDb, input);

    expect(mockDb.executeQuery).toHaveBeenCalledWith(input.query);
    expect(result).toEqual(dbError);
    expect(ErrorModule.logError).toHaveBeenCalled();
  });
});
