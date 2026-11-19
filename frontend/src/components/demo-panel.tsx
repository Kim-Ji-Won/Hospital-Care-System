"use client";

/**
 * 시연 패널 (화면 오른쪽 아래).
 * - 화면 상태: 조회 화면을 로딩·비어 있음·오류로 바꿔 설계서의 네 가지 상태를 보여 줌
 * - 빠른 로그인: 목 서버 계정으로 역할을 바로 바꿈 (목 서버가 로그인을 맡을 때만)
 * NEXT_PUBLIC_DEMO_PANEL=off 이면 보이지 않습니다.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { homePathOf, ME_KEY, useAuth } from "@/lib/auth";
import { getDemoState, mockedAreas, setDemoState, type DemoState } from "@/lib/demo";
import { demoAccounts, resetDb } from "@/mocks/db";
import type { Role } from "@/lib/api/types";
import { cx } from "./ui";

const STATES: { value: DemoState; label: string }[] = [
  { value: "normal", label: "기본" },
  { value: "loading", label: "로딩" },
  { value: "empty", label: "비어 있음" },
  { value: "error", label: "오류" },
];

export function DemoPanel() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<DemoState>(() => getDemoState());
  const queryClient = useQueryClient();
  const router = useRouter();
  const { user, login, switchUser } = useAuth();

  if (process.env.NEXT_PUBLIC_DEMO_PANEL === "off") return null;

  const areas = mockedAreas();
  const authMocked = areas === "all" || (Array.isArray(areas) && areas.includes("member"));

  function changeState(next: DemoState) {
    setDemoState(next);
    setState(next);
    queryClient.resetQueries({ predicate: (q) => q.queryKey[0] !== ME_KEY[0] });
  }

  async function quickLogin(account: { accountType: "환자" | "의료진"; loginId: string; password: string; role: string }) {
    await login({ accountType: account.accountType, loginId: account.loginId, password: account.password });
    router.push(homePathOf(account.role as Role));
  }

  return (
    <div className="fixed right-4 bottom-4 z-50 flex flex-col items-end gap-2 text-body">
      {open && (
        <div className="w-72 rounded-xl border border-sky bg-white p-4 shadow-lg">
          <p className="text-caption font-semibold text-ink-sub">화면 상태 (조회 화면에 적용)</p>
          <div className="mt-2 grid grid-cols-4 gap-1">
            {STATES.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => changeState(s.value)}
                aria-pressed={state === s.value}
                className={cx(
                  "rounded-md py-1.5 text-caption font-semibold",
                  state === s.value ? "bg-navy text-white" : "bg-page text-navy hover:bg-select-bg",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>

          {authMocked && (
            <>
              <p className="mt-4 text-caption font-semibold text-ink-sub">빠른 로그인 (목 서버 계정)</p>
              <ul className="mt-2 flex flex-col gap-1">
                {demoAccounts().map((a) => (
                  <li key={`${a.accountType}-${a.loginId}`}>
                    <button
                      type="button"
                      onClick={() => quickLogin(a)}
                      className={cx(
                        "flex w-full justify-between rounded-md px-2 py-1.5 text-left hover:bg-select-bg",
                        user?.loginId === a.loginId && user.role === a.role && "bg-select-bg",
                      )}
                    >
                      <span className="font-semibold text-ink">{a.name}</span>
                      <span className="text-caption text-ink-sub">{a.role}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="mt-3 text-caption text-ink-sub underline underline-offset-2 hover:text-navy"
                onClick={() => {
                  resetDb(); // 세션도 비워지므로 로그아웃 상태가 됨
                  switchUser(null);
                  router.replace("/login");
                }}
              >
                목 데이터 처음으로 되돌리기
              </button>
            </>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cx(
          "rounded-full px-4 py-2 text-caption font-semibold shadow-md",
          state === "normal" ? "bg-navy text-white" : "bg-warn text-white",
        )}
      >
        시연{state !== "normal" && ` · ${STATES.find((s) => s.value === state)?.label}`}
      </button>
    </div>
  );
}
