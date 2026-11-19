"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { homePathOf, useAuth } from "@/lib/auth";

/** /staff 로 들어오면 직종별 첫 화면으로 */
export default function StaffIndex() {
  const { user } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (user) router.replace(homePathOf(user.role));
  }, [user, router]);
  return null;
}
