"use client";

/**
 * S3a 환자 정보 수정 — API 1-6, 1-10
 * 이름·생년월일·성별·연락처는 NOT NULL이라 필수, 주소·혈액형은 비울 수 있습니다. 고친 칸만 보냅니다.
 * 환자번호(PK)와 로그인ID는 보기만 합니다. 새 환자 등록은 하지 않습니다(웹 회원가입으로만).
 */
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/client";
import { memberApi, memberKeys } from "@/lib/api/member";
import type { Gender, PatientDetail, UpdatePatientRequest } from "@/lib/api/types";
import { patientNo, today } from "@/lib/date";
import { Button, Card, ErrorState, PageHeader, Skeleton, TextField, cx } from "@/components/ui";

export default function EditPatientPage() {
  const patientId = Number(useParams<{ patientId: string }>().patientId);
  const detail = useQuery({ queryKey: memberKeys.patient(patientId), queryFn: () => memberApi.patient(patientId), enabled: patientId > 0 });
  if (detail.isPending) return <Skeleton rows={6} />;
  if (detail.isError) {
    return <ErrorState title="환자 정보를 불러오지 못했습니다" cause={detail.error instanceof ApiError && detail.error.status === 404 ? "없는 환자번호입니다." : "잠시 뒤 다시 시도하세요."} />;
  }
  return <EditForm patient={detail.data} />;
}

function EditForm({ patient: p }: { patient: PatientDetail }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: p.name, birthDate: p.birthDate, gender: p.gender, phone: p.phone, address: p.address ?? "", bloodType: p.bloodType ?? "" });
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  // 고친 칸만 보냄. 주소·혈액형을 비우면 null
  const changes: UpdatePatientRequest = {};
  if (form.name !== p.name) changes.name = form.name;
  if (form.birthDate !== p.birthDate) changes.birthDate = form.birthDate;
  if (form.gender !== p.gender) changes.gender = form.gender as Gender;
  if (form.phone !== p.phone) changes.phone = form.phone;
  if (form.address !== (p.address ?? "")) changes.address = form.address.trim() || null;
  if (form.bloodType !== (p.bloodType ?? "")) changes.bloodType = form.bloodType.trim() || null;
  const changed = Object.keys(changes).length > 0;

  const save = useMutation({
    mutationFn: () => memberApi.update(p.patientId, changes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: memberKeys.all });
      router.push(`/staff/patients/${p.patientId}`);
    },
  });
  const errors = save.error instanceof ApiError && save.error.code === "VALIDATION_FAILED" ? save.error.fieldMap() : {};
  // 저장 전에 필수 칸이 비었는지 먼저 알려 줌 (서버도 같은 규칙으로 막음)
  const required = { name: !form.name.trim(), birthDate: !form.birthDate, phone: !form.phone.trim() };
  const missing = Object.values(required).some(Boolean);

  return (
    <>
      <PageHeader title={`${p.name} ${patientNo(p.patientId)} 정보 수정`} />
      <div className="grid grid-cols-[1fr_300px] gap-6">
        <div className="flex flex-col gap-5">
          {save.isError && (
            <ErrorState
              title="저장하지 못했습니다"
              cause={Object.keys(errors).length ? `${Object.values(errors)[0]} 다른 칸에서 고친 내용은 그대로 있습니다.` : "잠시 뒤 다시 저장하세요. 고친 내용은 그대로 있습니다."}
            />
          )}
          <Card className="flex flex-col gap-4">
            <p className="text-body font-bold text-ink-sub">필수</p>
            <div className="grid grid-cols-2 gap-4">
              <TextField label="이름" value={form.name} maxLength={50} onChange={set("name")} error={errors.name ?? (required.name ? "필수 항목입니다." : undefined)} />
              <TextField label="생년월일" type="date" min="1900-01-01" max={today()} value={form.birthDate} onChange={set("birthDate")} error={errors.birthDate ?? (required.birthDate ? "필수 항목입니다." : undefined)} />
              <div className="flex flex-col gap-1.5">
                <span className="text-caption font-semibold text-ink-sub">성별</span>
                <div className="grid grid-cols-2 gap-2">
                  {(["남", "여"] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      aria-pressed={form.gender === g}
                      onClick={() => setForm((f) => ({ ...f, gender: g }))}
                      className={cx("h-11 rounded-lg border text-item", form.gender === g ? "border-navy bg-navy font-bold text-white" : "border-line/60 bg-white hover:bg-select-bg")}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
              <TextField label="연락처" value={form.phone} maxLength={20} inputMode="tel" onChange={set("phone")} error={errors.phone ?? (required.phone ? "필수 항목입니다." : undefined)} />
            </div>
          </Card>
          <Card className="flex flex-col gap-4">
            <p className="text-body font-bold text-ink-sub">선택</p>
            <div className="grid grid-cols-2 gap-4">
              <TextField label="주소" value={form.address} maxLength={200} onChange={set("address")} placeholder="비어 있음" error={errors.address} />
              <TextField label="혈액형" value={form.bloodType} maxLength={10} onChange={set("bloodType")} placeholder="비어 있음" error={errors.bloodType} />
            </div>
          </Card>
          <Button className="h-11 self-start px-8 text-item" disabled={!changed || missing || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "저장하는 중…" : "수정 저장"}
          </Button>
        </div>
        <Card className="flex flex-col gap-2 self-start bg-page">
          <p className="text-body font-bold text-ink-sub">고칠 수 없는 칸</p>
          <p className="text-body text-ink">
            환자번호({patientNo(p.patientId)})와 로그인 아이디({p.loginId || "없음"})는 보기만 합니다. 환자 등록은 웹 회원가입으로만 합니다.
          </p>
        </Card>
      </div>
    </>
  );
}
