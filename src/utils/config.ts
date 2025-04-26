import dotenv from "dotenv";

// 環境変数の読み込み
dotenv.config();

export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

// 環境変数から設定を取得
export function getDatabaseConfig(): DatabaseConfig {
  return {
    host: process.env.MYSQL_HOST || "localhost",
    port: Number.parseInt(process.env.MYSQL_PORT || "3306", 10),
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "test"
  };
}

// 環境変数が適切に設定されているか確認
export function validateDatabaseConfig(config: DatabaseConfig): string | null {
  if (!config.host) return "MYSQL_HOST is not set";
  if (Number.isNaN(config.port)) return "MYSQL_PORT is not a valid number";
  if (!config.user) return "MYSQL_USER is not set";
  if (!config.database) return "MYSQL_DATABASE is not set";
  return null;
}
