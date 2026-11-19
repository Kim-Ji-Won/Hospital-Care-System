"use client";

import { RoleGuard } from "@/components/role-guard";
import { StaffShell } from "@/components/staff-shell";

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return <RoleGuard roles={["의사", "간호사", "원무"]}>{(user) => <StaffShell user={user}>{children}</StaffShell>}</RoleGuard>;
}
