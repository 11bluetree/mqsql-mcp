import { describe, expect, test } from "@jest/globals";
import { validateSelectQuery } from "../validation.js";

describe("validateSelectQuery", () => {
  describe("正常系", () => {
    test("単純なSELECTクエリは実行できる", () => {
      const result = validateSelectQuery("SELECT * FROM users");
      expect(result.valid).toBe(true);
      expect(result.message).toBeUndefined();
    });

    test("大文字小文字の違いは無視される", () => {
      const result = validateSelectQuery("select * from users");
      expect(result.valid).toBe(true);
    });

    test("前後の空白は無視される", () => {
      const result = validateSelectQuery("  SELECT * FROM users  ");
      expect(result.valid).toBe(true);
    });

    test("WHERE句を含むSELECTクエリは実行できる", () => {
      const result = validateSelectQuery("SELECT * FROM users WHERE id = 1");
      expect(result.valid).toBe(true);
    });

    test("JOIN句を含むSELECTクエリは実行できる", () => {
      const result = validateSelectQuery(
        "SELECT users.name, orders.id FROM users JOIN orders ON users.id = orders.user_id"
      );
      expect(result.valid).toBe(true);
    });

    test("GROUP BY句を含むSELECTクエリは実行できる", () => {
      const result = validateSelectQuery(
        "SELECT count(*) FROM users GROUP BY status"
      );
      expect(result.valid).toBe(true);
    });

    test("ORDER BY句を含むSELECTクエリは実行できる", () => {
      const result = validateSelectQuery(
        "SELECT * FROM users ORDER BY created_at DESC"
      );
      expect(result.valid).toBe(true);
    });

    test("テーブル名やカラム名に危険な単語を含むクエリは実行できる", () => {
      const result = validateSelectQuery(
        "SELECT created_at, update_time FROM alter_table"
      );
      expect(result.valid).toBe(true);
    });

    test("文字列内に危険なキーワードを含むクエリは実行できる", () => {
      const result = validateSelectQuery(
        "SELECT * FROM users WHERE action = 'create'"
      );
      expect(result.valid).toBe(true);
    });

    test("文字列内に複数の危険なキーワードを含むクエリは実行できる", () => {
      const result = validateSelectQuery(
        "SELECT * FROM logs WHERE operation IN ('create', 'update', 'delete')"
      );
      expect(result.valid).toBe(true);
    });
  });

  describe("異常系", () => {
    test("SELECTで始まらないクエリは実行できない", () => {
      const result = validateSelectQuery(
        "INSERT INTO users VALUES (1, 'test')"
      );
      expect(result.valid).toBe(false);
      expect(result.message).toBe("Only SELECT queries are allowed");
    });

    test("INSERT文を含むクエリは実行できない", () => {
      const result = validateSelectQuery(
        "SELECT * FROM users INSERT INTO logs VALUES (1)"
      );
      expect(result.valid).toBe(false);
      expect(result.message).toBe("Query contains forbidden keyword: insert");
    });

    test("UPDATE文を含むクエリは実行できない", () => {
      const result = validateSelectQuery(
        "SELECT * FROM users UPDATE users SET name = 'test'"
      );
      expect(result.valid).toBe(false);
      expect(result.message).toBe("Query contains forbidden keyword: update");
    });

    test("DROP文を含むクエリは実行できない", () => {
      const result = validateSelectQuery("SELECT * DROP TABLE users");
      expect(result.valid).toBe(false);
      expect(result.message).toBe("Query contains forbidden keyword: drop");
    });

    test("INTO OUTFILEを含むクエリは実行できない", () => {
      const result = validateSelectQuery(
        "SELECT * FROM users INTO OUTFILE '/tmp/result.txt'"
      );
      expect(result.valid).toBe(false);
      expect(result.message).toBe(
        "Query contains forbidden keyword: into outfile"
      );
    });

    test("セミコロンを含むクエリは実行できない", () => {
      const result = validateSelectQuery(
        "SELECT * FROM users; SELECT * FROM orders"
      );
      expect(result.valid).toBe(false);
      expect(result.message).toBe("Multiple SQL statements are not allowed");
    });

    test("単語の境界チェックは正確に行われる", () => {
      const result = validateSelectQuery(
        "SELECT * FROM selections WHERE updated_time > '2023-01-01'"
      );
      expect(result.valid).toBe(true);
    });

    test("「OR 1=1」を含むクエリは実行できない", () => {
      const result = validateSelectQuery(
        "SELECT * FROM users WHERE name = 'test' OR 1=1"
      );
      expect(result.valid).toBe(false);
      expect(result.message).toBe(
        "Query contains potential SQL injection pattern"
      );
    });

    test("「OR '='」を含むクエリは実行できない", () => {
      const result = validateSelectQuery(
        "SELECT * FROM users WHERE name = 'test' OR '='"
      );
      expect(result.valid).toBe(false);
      expect(result.message).toBe(
        "Query contains potential SQL injection pattern"
      );
    });

    test("SQLコメント（--）を含むクエリは実行できない", () => {
      const result = validateSelectQuery("SELECT * FROM users -- WHERE id = 1");
      expect(result.valid).toBe(false);
      expect(result.message).toBe(
        "Query contains potential SQL injection pattern"
      );
    });

    describe("悪意のあるクエリは実行できない", () => {
      test("SLEEP関数を含むクエリは実行できない", () => {
        const result = validateSelectQuery("SELECT *, SLEEP(10) FROM users");
        expect(result.valid).toBe(false);
        expect(result.message).toBe("Query contains dangerous function: sleep");
      });

      test("BENCHMARK関数を含むクエリは実行できない", () => {
        const result = validateSelectQuery(
          "SELECT *, BENCHMARK(10000000, SHA1('test')) FROM users"
        );
        expect(result.valid).toBe(false);
        expect(result.message).toBe(
          "Query contains dangerous function: benchmark"
        );
      });

      test("LOAD_FILE関数を含むクエリは実行できない", () => {
        const result = validateSelectQuery(
          "SELECT id, LOAD_FILE('/etc/passwd') FROM users"
        );
        expect(result.valid).toBe(false);
        expect(result.message).toBe(
          "Query contains dangerous function: load_file"
        );
      });

      test("ネストしたLOAD_FILE関数を含クエリは実行できない", () => {
        const result = validateSelectQuery(
          "SELECT id FROM users WHERE name = CONCAT(LOAD_FILE('/etc/passwd'), 'suffix')"
        );
        expect(result.valid).toBe(false);
        expect(result.message).toBe(
          "Query contains dangerous function: load_file"
        );
      });

      test("DATABASE関数を含むクエリは実行できない", () => {
        const result = validateSelectQuery("SELECT DATABASE() FROM users");
        expect(result.valid).toBe(false);
        expect(result.message).toBe(
          "Query contains dangerous function: database()"
        );
      });

      test("USER関数を含むクエリは実行できない", () => {
        const result = validateSelectQuery(
          "SELECT USER() FROM information_schema.tables"
        );
        expect(result.valid).toBe(false);
        expect(result.message).toBe(
          "Query contains dangerous function: user()"
        );
      });

      test("VERSION関数を含むクエリは実行できない", () => {
        const result = validateSelectQuery("SELECT VERSION() FROM dual");
        expect(result.valid).toBe(false);
        expect(result.message).toBe(
          "Query contains dangerous function: version()"
        );
      });
    });
  });
});
