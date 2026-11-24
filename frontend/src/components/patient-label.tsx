/** 환자 한 줄 표기: "김서연 · 여 32세 · #10234" */
import type { PatientSummary } from "@/lib/api/types";
import { age, patientNo } from "@/lib/date";

export function patientLine(p: PatientSummary) {
  return `${p.gender} ${age(p.birthDate)}세 · ${patientNo(p.patientId)}`;
}

export function PatientName({ patient, compact }: { patient: PatientSummary; compact?: boolean }) {
  return (
    <span className="flex flex-col">
      <span className="text-item font-semibold whitespace-nowrap text-ink">{patient.name}</span>
      <span className="text-caption whitespace-nowrap text-ink-sub">{compact ? `${patient.gender} ${age(patient.birthDate)}` : patientLine(patient)}</span>
    </span>
  );
}
