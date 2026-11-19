/**
 * 시연 패널 설정. 브라우저에만 저장하는 개인 설정이라 localStorage를 씁니다.
 * - state: 조회 화면을 일부러 로딩·빈 화면·오류로 보여 줌 (설계서의 네 가지 상태 시연용)
 */
export type DemoState = "normal" | "loading" | "empty" | "error";

const STATE_KEY = "demo:state";

export function getDemoState(): DemoState {
  if (typeof window === "undefined") return "normal";
  try {
    const value = window.localStorage.getItem(STATE_KEY);
    return value === "loading" || value === "empty" || value === "error" ? value : "normal";
  } catch {
    return "normal";
  }
}

export function setDemoState(state: DemoState) {
  try {
    if (state === "normal") window.localStorage.removeItem(STATE_KEY);
    else window.localStorage.setItem(STATE_KEY, state);
  } catch {
    // 저장할 수 없는 브라우저면 무시
  }
}

/** 목 서버 사용 범위: NEXT_PUBLIC_API_MOCKING = "all" | "none" | "auth,department" 처럼 영역 목록 */
export function mockedAreas(): "all" | "none" | string[] {
  const raw = (process.env.NEXT_PUBLIC_API_MOCKING ?? "all").trim();
  if (raw === "all" || raw === "") return "all";
  if (raw === "none") return "none";
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}
