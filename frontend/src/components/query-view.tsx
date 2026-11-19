"use client";

/**
 * 조회 화면의 네 가지 상태(기본·로딩·비어 있음·오류)를 한 곳에서 고릅니다.
 * 화면은 기본 상태만 그리고, 나머지는 여기에 맡깁니다.
 */
import type { ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { NetworkError } from "@/lib/api/client";
import { Button, EmptyState, ErrorState, Skeleton } from "./ui";

interface QueryViewProps<T> {
  query: UseQueryResult<T>;
  /** 로딩 뼈대 줄 수 */
  skeletonRows?: number;
  /** 데이터가 비었는지. 없으면 배열 길이로 판단 */
  isEmpty?: (data: T) => boolean;
  empty?: { title: string; description?: string; action?: ReactNode };
  errorTitle?: string;
  children: (data: T) => ReactNode;
}

export function QueryView<T>({ query, skeletonRows = 4, isEmpty, empty, errorTitle = "불러오지 못했습니다", children }: QueryViewProps<T>) {
  if (query.isPending) return <Skeleton rows={skeletonRows} />;

  if (query.isError) {
    const cause =
      query.error instanceof NetworkError
        ? "서버와 연결이 끊겼습니다. 네트워크를 확인한 뒤 다시 시도하세요."
        : "잠시 뒤 다시 시도하세요. 계속되면 원무과(02-555-0142)로 문의하세요.";
    return (
      <ErrorState
        title={errorTitle}
        cause={cause}
        action={
          <Button variant="secondary" onClick={() => query.refetch()}>
            다시 시도
          </Button>
        }
      />
    );
  }

  const data = query.data;
  const emptyNow = isEmpty ? isEmpty(data) : Array.isArray(data) && data.length === 0;
  if (emptyNow && empty) return <EmptyState {...empty} />;

  return <>{children(data)}</>;
}
