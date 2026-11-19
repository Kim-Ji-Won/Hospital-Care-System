import type { ApiErrorBody } from "./types";
import { getDemoState } from "@/lib/demo";

/** 백엔드가 README 오류 형식으로 돌려준 오류. code로 화면 문구를 고릅니다. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: ApiErrorBody["fields"];
  readonly details: ApiErrorBody["details"];

  constructor(status: number, body: Partial<ApiErrorBody>) {
    super(body.message ?? `요청이 실패했습니다 (${status})`);
    this.name = "ApiError";
    this.status = status;
    this.code = body.code ?? (status >= 500 ? "INTERNAL_ERROR" : "UNKNOWN");
    this.fields = body.fields ?? null;
    this.details = body.details ?? null;
  }

  /** VALIDATION_FAILED의 칸별 이유를 { 칸 이름: 이유 }로 */
  fieldMap(): Record<string, string> {
    return Object.fromEntries((this.fields ?? []).map((f) => [f.field, f.reason]));
  }
}

/** 서버에 닿지 못했을 때(백엔드 꺼짐 등). 화면은 "연결 끊김" 오류로 보여 줍니다. */
export class NetworkError extends Error {
  constructor() {
    super("서버에 연결하지 못했습니다");
    this.name = "NetworkError";
  }
}

type Method = "GET" | "POST" | "PATCH" | "DELETE";

interface RequestOptions {
  query?: Record<string, string | number | boolean | undefined | (string | number)[]>;
  body?: unknown;
}

function buildUrl(path: string, query?: RequestOptions["query"]) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined) continue;
    for (const v of Array.isArray(value) ? value : [value]) params.append(key, String(v));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

async function request<T>(method: Method, path: string, options: RequestOptions = {}): Promise<T> {
  // 시연 패널: 조회(GET)만 로딩·빈 화면·오류 상태를 일부러 만듭니다. 백엔드와 연결해도 동작합니다.
  // 로그인 확인(/api/auth)은 빼야 로그인 화면으로 튕기지 않습니다.
  const demo = method === "GET" && !path.startsWith("/api/auth") ? getDemoState() : "normal";
  if (demo === "loading") await new Promise(() => {});
  if (demo === "error") throw new ApiError(500, { code: "INTERNAL_ERROR", message: "시연용 오류" });

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method,
      credentials: "include",
      headers: options.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new NetworkError();
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as Partial<ApiErrorBody>;
    throw new ApiError(response.status, body);
  }
  if (response.status === 204) return undefined as T;

  const data = (await response.json()) as T;
  if (demo === "empty" && Array.isArray(data)) return [] as T;
  return data;
}

export const api = {
  get: <T>(path: string, query?: RequestOptions["query"]) => request<T>("GET", path, { query }),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, { body }),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, { body }),
  delete: <T = void>(path: string) => request<T>("DELETE", path),
};
