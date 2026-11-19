"use client";

import { useEffect, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/lib/auth";
import { DemoPanel } from "@/components/demo-panel";
import { ApiError } from "@/lib/api/client";

let browserQueryClient: QueryClient | undefined;

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // 4xx는 다시 시도해도 같으므로 바로 오류 화면으로
        retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 1,
        refetchOnWindowFocus: false,
      },
    },
  });
}

function getQueryClient() {
  if (typeof window === "undefined") return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}

export function Providers({ children }: { children: ReactNode }) {
  // 목 서버가 켜진 뒤에 로그인 확인(1-3)을 시작합니다. 첫 요청이 목 서버를 비켜 가지 않게 하려는 것입니다.
  // 로그인 확인 전에는 보호된 화면이 뼈대만 보여 주므로, 다른 조회도 목 서버가 켜진 뒤에 나갑니다.
  const [mockReady, setMockReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    import("@/mocks/browser")
      .then(({ startMockWorker }) => startMockWorker())
      .catch((e) => console.error("목 서버를 켜지 못했습니다", e))
      .finally(() => {
        if (!cancelled) setMockReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <QueryClientProvider client={getQueryClient()}>
      <AuthProvider enabled={mockReady}>
        {children}
        {mockReady && <DemoPanel />}
      </AuthProvider>
    </QueryClientProvider>
  );
}
