export interface D1Result<T = Record<string, unknown>> {
  results: T[];
  success: boolean;
  meta: { changes?: number };
}
export interface Statement {
  bind(...values: unknown[]): Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<D1Result>;
}
export interface Database {
  prepare(sql: string): Statement;
  batch(statements: Statement[]): Promise<D1Result[]>;
}
export interface BaseEnv {
  DB: Database;
}
export type RecordData = Record<string, unknown>;
export const resources = [
  "content",
  "skills",
  "projects",
  "posts",
  "settings",
  "media",
] as const;
export type Resource = (typeof resources)[number];
export const pages = ["home", "about", "skills", "contact"] as const;
export type Page = (typeof pages)[number];
