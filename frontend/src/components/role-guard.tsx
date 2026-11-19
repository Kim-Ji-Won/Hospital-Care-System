"use client";

/** 로그인과 역할 확인. 로그인 안 했으면 로그인 화면으로, 역할이 다르면 S9 권한 없음 화면. */
import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { homePathOf, useAuth } from "@/lib/auth";
import type { Role, SessionUser } from "@/lib/api/types";
import { Skeleton } from "./ui";

export function RoleGuard({ roles, children }: { roles: Role[]; children: (user: SessionUser) => ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user === null) router.replace("/login");
  }, [user, router]);

  if (!user) {
    return (
      <div className="mx-auto max-w-[1200px] p-8">
        <Skeleton rows={5} />
      </div>
    );
  }

  if (!roles.includes(user.role)) {
    return (
      <div className="mx-auto mt-24 flex max-w-md flex-col items-center gap-3 rounded-xl border border-sky bg-white p-8 text-center">
        <p className="text-title font-bold text-navy">이 화면을 볼 권한이 없습니다</p>
        <p className="text-body text-ink-sub">
          지금은 {user.role} 계정으로 로그인되어 있습니다. 다른 계정으로 로그인했다면 계정을 확인하세요.
        </p>
        <Link href={homePathOf(user.role)} className="mt-2 font-semibold text-navy underline underline-offset-4">
          내 첫 화면으로 돌아가기
        </Link>
      </div>
    );
  }

  return <>{children(user)}</>;
}
