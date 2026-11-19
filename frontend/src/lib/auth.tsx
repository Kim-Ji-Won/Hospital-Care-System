"use client";

/** 로그인 상태. 1-3(GET /api/auth/me)을 TanStack Query로 들고 있습니다. */
import { createContext, useContext, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/client";
import { memberApi } from "@/lib/api/member";
import type { LoginRequest, Role, SessionUser, SignupRequest } from "@/lib/api/types";

interface AuthValue {
  /** undefined: 확인 중, null: 로그인 안 됨 */
  user: SessionUser | null | undefined;
  login: (body: LoginRequest) => Promise<SessionUser>;
  signup: (body: SignupRequest) => Promise<SessionUser>;
  logout: () => Promise<void>;
  /** 로그인 사용자를 바꾸고 이전 사용자의 캐시를 지움 (시연 패널의 데이터 초기화에서도 씀) */
  switchUser: (user: SessionUser | null) => void;
}

const AuthContext = createContext<AuthValue | null>(null);
export const ME_KEY = ["auth", "me"] as const;

export function AuthProvider({ children, enabled }: { children: ReactNode; enabled: boolean }) {
  const queryClient = useQueryClient();
  const { data, isPending, error } = useQuery({
    enabled,
    queryKey: ME_KEY,
    queryFn: async () => {
      try {
        return await memberApi.me();
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    retry: false,
    staleTime: 60_000,
  });

  /**
   * 로그인 사용자가 바뀌면 로그인 정보는 그대로 덮어쓰고, 다른 사람의 데이터만 캐시에서 지웁니다.
   * (queryClient.clear()를 쓰면 보고 있던 로그인 정보까지 사라져 화면이 옛 사용자로 남습니다.)
   */
  function switchUser(user: SessionUser | null) {
    queryClient.setQueryData(ME_KEY, user);
    queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== ME_KEY[0] });
  }

  const value: AuthValue = {
    user: isPending ? undefined : error ? null : data,
    async login(body) {
      const user = await memberApi.login(body);
      switchUser(user);
      return user;
    },
    async signup(body) {
      const user = await memberApi.signup(body);
      switchUser(user);
      return user;
    },
    async logout() {
      await memberApi.logout().catch(() => undefined);
      switchUser(null);
    },
    switchUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth는 AuthProvider 안에서만 쓸 수 있습니다");
  return value;
}

/** 역할별 첫 화면: 환자 홈, 의사·간호사 오늘 진료, 원무 수납 */
export function homePathOf(role: Role) {
  if (role === "환자") return "/";
  if (role === "원무") return "/staff/billing";
  return "/staff/today";
}
