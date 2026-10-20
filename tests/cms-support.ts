import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { readFileSync } from "node:fs";
import type { Database, Statement, D1Result } from "../cms/shared/types.ts";
export class LocalD1 implements Database {
  sqlite = new DatabaseSync(":memory:");
  constructor(migrate = true) {
    this.sqlite.exec(
      readFileSync(new URL("../cms/schema.local.sql", import.meta.url), "utf8"),
    );
    if (migrate) this.migrate();
  }
  migrate() {
    this.sqlite.exec(
      readFileSync(
        new URL("../cms/migrations/0001_cms_metadata.sql", import.meta.url),
        "utf8",
      ),
    );
  }
  prepare(sql: string): Statement {
    const db = this.sqlite;
    const make = (values: unknown[]): Statement => ({
      bind: (...next: unknown[]) => make(next),
      first: async <T>() =>
        (db.prepare(sql).get(...(values as SQLInputValue[])) ??
          null) as T | null,
      all: async <T>() => ({
        results: db.prepare(sql).all(...(values as SQLInputValue[])) as T[],
        success: true,
        meta: {},
      }),
      run: async () => {
        const result = db.prepare(sql).run(...(values as SQLInputValue[]));
        return {
          results: [],
          success: true,
          meta: { changes: Number(result.changes) },
        };
      },
    });
    return make([]);
  }
  async batch(statements: Statement[]): Promise<D1Result[]> {
    this.sqlite.exec("BEGIN");
    try {
      const result = await Promise.all(
        statements.map((statement) => statement.run()),
      );
      this.sqlite.exec("COMMIT");
      return result;
    } catch (error) {
      this.sqlite.exec("ROLLBACK");
      throw error;
    }
  }
  close() {
    this.sqlite.close();
  }
}
export const issuer = "https://cms-tests.cloudflareaccess.com";
export const audience = "test-cms-audience";
export const origin = "https://kmuhammadali.github.io";
export async function signer() {
  const pair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  const jwk = {
    ...(await crypto.subtle.exportKey("jwk", pair.publicKey)),
    kid: "test-key",
    alg: "RS256",
    use: "sig",
  };
  const encode = (data: unknown) =>
    Buffer.from(JSON.stringify(data)).toString("base64url");
  return {
    jwk,
    async token(
      patch: Record<string, unknown> = {},
      headerPatch: Record<string, unknown> = {},
    ) {
      const now = Math.floor(Date.now() / 1000);
      const head = encode({ alg: "RS256", kid: "test-key", ...headerPatch });
      const body = encode({
        iss: issuer,
        aud: [audience],
        exp: now + 3600,
        iat: now - 5,
        sub: "admin-user",
        ...patch,
      });
      const signature = await crypto.subtle.sign(
        "RSASSA-PKCS1-v1_5",
        pair.privateKey,
        new TextEncoder().encode(`${head}.${body}`),
      );
      return `${head}.${body}.${Buffer.from(signature).toString("base64url")}`;
    },
  };
}
