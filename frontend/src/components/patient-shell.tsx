"use client";

/** 환자 화면 틀: 상단 메뉴 6개 (UI 설계서 웹 배치 규칙) */
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import type { SessionUser } from "@/lib/api/types";
import { cx } from "./ui";

const MENU = [
  { href: "/", label: "홈" },
  { href: "/book", label: "진료 예약" },
  { href: "/reservations", label: "내 예약" },
  { href: "/records", label: "진료 기록" },
  { href: "/results", label: "검사 결과" },
  { href: "/payments", label: "결제 내역" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" || pathname.startsWith("/admission") : pathname.startsWith(href);
}

export function PatientShell({ user, children }: { user: SessionUser; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();

  return (
    <div className="min-h-screen">
      <header className="border-b border-sky bg-white">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-8 px-6">
          <Link href="/" className="text-item font-bold text-navy">
            병원 예약·진료
          </Link>
          <nav aria-label="환자 메뉴" className="flex h-full gap-1">
            {MENU.map((m) => (
              <Link
                key={m.href}
                href={m.href}
                aria-current={isActive(pathname, m.href) ? "page" : undefined}
                className={cx(
                  "flex h-full items-center border-b-2 px-3 text-body font-semibold",
                  isActive(pathname, m.href) ? "border-navy text-navy" : "border-transparent text-ink-sub hover:text-navy",
                )}
              >
                {m.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-body">
            <span className="text-ink">{user.name} 님</span>
            <button
              type="button"
              className="text-ink-sub hover:text-navy"
              onClick={async () => {
                await logout();
                router.replace("/login");
              }}
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1200px] px-6 py-8">{children}</main>
    </div>
  );
}
