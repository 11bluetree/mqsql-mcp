#!/usr/bin/env node
import { MySQLMCPServer } from "./server";

// バナーを表示
console.info(`
┌────────────────────────────────────────┐
│          MySQL MCP Server              │
│                                        │
│  SELECT queries only for security      │
│  Powered by Model Context Protocol     │
└────────────────────────────────────────┘
`);

// サーバーを起動
const server = new MySQLMCPServer();
server.start().catch((error) => {
  console.error("Failed to start MySQL MCP server:", error);
  process.exit(1);
});
