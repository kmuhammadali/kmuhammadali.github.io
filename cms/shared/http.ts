import { ApiError } from "./validation.ts";
export function json(
  value: unknown,
  status = 200,
  headers?: HeadersInit,
): Response {
  return Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...Object.fromEntries(new Headers(headers)),
    },
  });
}
export async function readJSON(request: Request): Promise<unknown> {
  if (
    request.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  )
    throw new ApiError(415, "Content-Type must be application/json");
  const max = 256 * 1024;
  if (Number(request.headers.get("Content-Length")) > max)
    throw new ApiError(413, "Request too large");
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "JSON body required");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) {
        await reader.cancel();
        throw new ApiError(413, "Request too large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const data = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(data));
  } catch {
    throw new ApiError(400, "Invalid JSON");
  }
}
