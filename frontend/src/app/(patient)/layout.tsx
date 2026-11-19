"use client";

import { RoleGuard } from "@/components/role-guard";
import { PatientShell } from "@/components/patient-shell";

export default function PatientLayout({ children }: { children: React.ReactNode }) {
  return <RoleGuard roles={["환자"]}>{(user) => <PatientShell user={user}>{children}</PatientShell>}</RoleGuard>;
}
