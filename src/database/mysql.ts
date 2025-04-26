import mysql from "mysql2/promise";
import { DatabaseConfig } from "../utils/config";
import {
  MCPError,
  createDatabaseConnectionError,
  createQueryExecutionError
} from "../utils/error.js";

export class MySQLDatabase {
  private config: DatabaseConfig;
  private connection: mysql.Connection | null = null;

  constructor(config: DatabaseConfig) {
    this.config = config;
  }

  /**
   * データベースに接続する
   */
  async connect(): Promise<void | MCPError> {
    try {
      this.connection = await mysql.createConnection({
        host: this.config.host,
        port: this.config.port,
        user: this.config.user,
        password: this.config.password,
        database: this.config.database
      });

      console.log(
        `Connected to MySQL database: ${this.config.database} at ${this.config.host}:${this.config.port}`
      );
    } catch (error) {
      return createDatabaseConnectionError(
        `Failed to connect to MySQL database: ${(error as Error).message}`,
        error
      );
    }
  }

  /**
   * データベース接続を閉じる
   */
  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.end();
      this.connection = null;
      console.log("Disconnected from MySQL database");
    }
  }

  /**
   * クエリを実行し結果を返す
   */
  async executeQuery(query: string): Promise<any[] | MCPError> {
    if (!this.connection) {
      return createDatabaseConnectionError(
        "Database connection is not established"
      );
    }

    try {
      // クエリを実行
      const [rows] = await this.connection.query(query);

      // 結果を配列として返す
      return Array.isArray(rows) ? rows : [rows];
    } catch (error) {
      return createQueryExecutionError(
        `Failed to execute query: ${(error as Error).message}`,
        error
      );
    }
  }

  /**
   * 接続状態を確認
   */
  isConnected(): boolean {
    return this.connection !== null;
  }
}
