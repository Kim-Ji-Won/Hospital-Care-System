"use client";

/**
 * 의료진 화면 틀: 왼쪽 사이드바 (의사·간호사 6개, 원무 2개).
 * 위에는 로그인한 사람의 이름·진료과·직종을 고정하고, 직종에 없는 메뉴는 보이지 않습니다.
 */
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import type { Role, SessionUser } from "@/lib/api/types";
import { cx } from "./ui";

const MENU: { href: string; label: string; roles: Role[] }[] = [
  { href: "/staff/today", label: "오늘 진료", roles: ["의사", "간호사"] },
  { href: "/staff/patients", label: "환자", roles: ["의사", "간호사", "원무"] },
  { href: "/staff/labs", label: "검사", roles: ["의사", "간호사"] },
  { href: "/staff/admissions", label: "입원·병실", roles: ["의사", "간호사"] },
  { href: "/staff/billing", label: "수납", roles: ["원무"] },
  { href: "/staff/schedules", label: "진료일정·휴진", roles: ["의사", "간호사"] },
  { href: "/staff/master", label: "기준 정보", roles: ["의사", "간호사"] },
];

export function StaffShell({ user, children }: { user: SessionUser; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  const menu = MENU.filter((m) => m.roles.includes(user.role));

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r border-sky bg-white">
        <div className="border-b border-sky px-5 py-5">
          <p className="text-item font-bold text-ink">{user.name}</p>
          <p className="mt-0.5 text-caption text-ink-sub">
            {user.departmentName ?? "원무과"} · {user.role}
          </p>
        </div>
        <nav aria-label="의료진 메뉴" className="flex flex-1 flex-col gap-0.5 p-3">
          {menu.map((m) => {
            const active = pathname.startsWith(m.href);
            return (
              <Link
                key={m.href}
                href={m.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "rounded-lg px-3 py-2.5 text-body font-semibold",
                  active ? "bg-select-bg text-navy" : "text-ink-sub hover:bg-page hover:text-navy",
                )}
              >
                {m.label}
              </Link>
            );
          })}
        </nav>
        <button
          type="button"
          className="m-3 rounded-lg px-3 py-2.5 text-left text-body text-ink-sub hover:bg-page hover:text-navy"
          onClick={async () => {
            await logout();
            router.replace("/login");
          }}
        >
          로그아웃
        </button>
      </aside>
      <main className="min-w-0 flex-1 px-8 py-8">
        <div className="mx-auto max-w-[1200px]">{children}</div>
      </main>
    </div>
  );
}
