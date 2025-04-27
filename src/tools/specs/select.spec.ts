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

  test("正常なSELECTクエリは実行できる", async () => {
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

  test("データベース接続がない場合は実行できない", async () => {
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

  test("無効なクエリは実行できない", async () => {
    const errorMessage = "Only SELECT queries are allowed";
    const input: SelectInput = { query: "DELETE FROM users" };

    const result = await selectTool(mockDb, input);

    expect(validateSelectQuery).toHaveBeenCalledWith(input.query);
    expect(mockDb.executeQuery).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        type: mockErrorType.VALIDATION_ERROR,
        message: errorMessage
      })
    );
    expect(ErrorModule.logError).toHaveBeenCalled();
  });

  test("SLEEP関数を含むクエリは実行できない", async () => {
    const errorMessage = "Query contains dangerous function: sleep";
    const input: SelectInput = { query: "SELECT SLEEP(5), id FROM users" };

    const result = await selectTool(mockDb, input);

    expect(validateSelectQuery).toHaveBeenCalledWith(input.query);
    expect(mockDb.executeQuery).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        type: mockErrorType.VALIDATION_ERROR,
        message: errorMessage
      })
    );
    expect(ErrorModule.logError).toHaveBeenCalled();
  });

  test("LOAD_FILE関数を含むクエリは実行できない", async () => {
    const errorMessage = "Query contains dangerous function: load_file";
    const input: SelectInput = { query: "SELECT LOAD_FILE('/etc/passwd')" };

    const result = await selectTool(mockDb, input);

    expect(validateSelectQuery).toHaveBeenCalledWith(input.query);
    expect(mockDb.executeQuery).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        type: mockErrorType.VALIDATION_ERROR,
        message: errorMessage
      })
    );
    expect(ErrorModule.logError).toHaveBeenCalled();
  });

  test("存在しないテーブルに対するクエリは実行できない", async () => {
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

  test("予期しない例外が発生した場合は実行できない", async () => {
    const unexpectedError = new Error("予期しないエラー");
    mockDb.executeQuery.mockRejectedValueOnce(unexpectedError);
    const input: SelectInput = { query: defaultQuery };

    const result = await selectTool(mockDb, input);

    expect(mockDb.executeQuery).toHaveBeenCalledWith(input.query);
    expect(result).toEqual(
      expect.objectContaining({
        type: mockErrorType.VALIDATION_ERROR,
        message: `Unexpected error: ${unexpectedError.message}`
      })
    );
    expect(ErrorModule.logError).toHaveBeenCalled();
  });
});
