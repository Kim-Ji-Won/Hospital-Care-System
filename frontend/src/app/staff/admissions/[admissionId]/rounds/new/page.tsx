"use client";

/**
 * S2b 회진 기록 — API 5-5, 3-1(회진), 4-6, 4-7
 * 진료 기록 작성(S2)과 같은 입력 부품을 쓰고, 환자 요약이 입원 정보로 바뀌며 오른쪽에 이 입원의 지난 회진이 보입니다.
 * 입원·병실 화면에서 들어오므로 진료구분은 '입원'(예약번호 NULL, 입원번호)으로 정하고 묻지 않습니다.
 * 회진 일시는 입원 기간 안이고, 처방은 원내만, 금액은 보이지 않습니다(퇴원 때 입원 청구에 합산).
 */
import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { admissionApi, admissionKeys } from "@/lib/api/admission";
import { ApiError } from "@/lib/api/client";
import { encounterApi, encounterKeys } from "@/lib/api/encounter";
import { orderKeys } from "@/lib/api/order";
import type { AdmissionDetail } from "@/lib/api/types";
import { useAuth } from "@/lib/auth";
import { age, daysBetween, fromInputDateTime, now, patientNo, shortDateTime, toInputDateTime } from "@/lib/date";
import { AddPanel, Field, Row, Section, textareaClass, type Adding, type DrugDraft, type ExamDraft } from "@/components/encounter-parts";
import { Button, EmptyState, ErrorState, PageHeader, Skeleton } from "@/components/ui";

export default function NewRoundPage() {
  const admissionId = Number(useParams<{ admissionId: string }>().admissionId);
  const detail = useQuery({ queryKey: admissionKeys.detail(admissionId), queryFn: () => admissionApi.detail(admissionId), enabled: admissionId > 0 });
  const back = <Link href="/staff/admissions" className="font-semibold text-navy underline underline-offset-4">입원·병실로 돌아가기</Link>;

  if (detail.isPending) return <Skeleton rows={6} />;
  if (detail.isError) {
    return (
      <ErrorState
        title="입원 정보를 불러오지 못했습니다"
        cause={detail.error instanceof ApiError && detail.error.status === 404 ? "없는 입원번호입니다." : "잠시 뒤 다시 시도하세요."}
        action={back}
      />
    );
  }
  if (detail.data.dischargedAt) {
    return (
      <>
        <PageHeader title="회진 기록" />
        <EmptyState title="퇴원한 입원입니다" description={`${shortDateTime(detail.data.dischargedAt)}에 퇴원했습니다. 회진 일시는 입원 기간 안이어야 해서 더 남길 수 없습니다.`} action={back} />
      </>
    );
  }
  return <RoundForm admission={detail.data} />;
}

function RoundForm({ admission: a }: { admission: AdmissionDetail }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isDoctor = user?.role === "의사";

  const [at, setAt] = useState(toInputDateTime(now()));
  const [symptom, setSymptom] = useState("");
  const [finding, setFinding] = useState("");
  const [drugs, setDrugs] = useState<DrugDraft[]>([]);
  const [exams, setExams] = useState<ExamDraft[]>([]);
  const [adding, setAdding] = useState<Adding>(null);

  const save = useMutation({
    mutationFn: () =>
      encounterApi.create({
        reservationId: null,
        admissionId: a.admissionId,
        encounterAt: fromInputDateTime(at),
        symptom: symptom.trim() || null,
        finding: finding.trim(),
        diagnoses: [],
        prescriptions: drugs.length
          ? [{ dispenseType: "원내", items: drugs.map(({ drugCode, dose, timesPerDay, durationDays, instruction }) => ({ drugCode, dose, timesPerDay, durationDays, instruction })) }]
          : [],
        exams: exams.map((x) => ({ examCode: x.examCode })),
        admissionDecided: false,
      }),
    onSuccess: () => {
      for (const key of [admissionKeys.all, orderKeys.all, encounterKeys.all]) queryClient.invalidateQueries({ queryKey: key });
      router.push("/staff/admissions");
    },
  });

  const errors = save.error instanceof ApiError && save.error.code === "VALIDATION_FAILED" ? save.error.fieldMap() : {};
  const sectionError = (prefix: string) => Object.entries(errors).find(([k]) => k === prefix || k.startsWith(`${prefix}[`))?.[1];
  const canSave = isDoctor && finding.trim().length > 0 && !!at && !save.isPending;
  const p = a.patient;

  return (
    <>
      <PageHeader title="회진 기록" />

      {/* 환자 요약: 외래(S2)의 예약 정보 대신 입원 정보 */}
      <div className="mb-6 rounded-2xl border border-sky bg-select-bg px-5 py-4">
        <p className="text-title font-bold text-ink">
          {p.name}{" "}
          <span className="text-body font-bold text-ink-sub">
            {p.gender} · {age(p.birthDate)}세 · {patientNo(p.patientId)} · 입원 {a.roomNo}호 · D+{daysBetween(a.admittedAt)} · 주치의 {a.attendingName} · {a.reason}
          </span>
        </p>
      </div>

      {!isDoctor && (
        <p className="mb-4 rounded-lg bg-neutral-bg px-4 py-3 text-body text-ink-sub">회진 기록은 의사만 저장할 수 있습니다. 지난 회진은 오른쪽에서 볼 수 있습니다.</p>
      )}
      {save.isError && !Object.keys(errors).length && (
        <div className="mb-6">
          <ErrorState
            title="회진 기록을 저장하지 못했습니다"
            cause={
              save.error instanceof ApiError && save.error.code === "INVALID_STATUS"
                ? "그 사이에 퇴원 처리된 입원입니다. 입원·병실 화면을 확인하세요."
                : "입력한 내용은 그대로 있으니 잠시 뒤 다시 저장하세요."
            }
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        {/* 왼쪽: 회진 내용 */}
        <div className="flex flex-col gap-5">
          <Field label="회진 일시" error={errors.encounterAt}>
            {/* 입원일시보다 빠르거나 지금보다 늦은 시각은 고를 수 없게 범위를 제한 */}
            <input
              type="datetime-local"
              value={at}
              min={toInputDateTime(a.admittedAt)}
              max={toInputDateTime(now())}
              onChange={(e) => setAt(e.target.value)}
              className="h-11 rounded-xl border border-line/60 bg-white px-4 text-item outline-none focus:border-navy"
            />
          </Field>
          <Field label="증상" error={errors.symptom}>
            <textarea value={symptom} onChange={(e) => setSymptom(e.target.value)} rows={2} className={textareaClass(!!errors.symptom)} placeholder="없으면 비워 두세요" />
          </Field>
          <Field
            label="소견 (필수)"
            error={errors.finding}
            extra={
              <button type="button" onClick={() => setFinding("특이 소견 없음")} className="rounded-full bg-page px-2.5 py-1 text-caption font-semibold text-navy hover:bg-select-bg">
                특이 소견 없음
              </button>
            }
          >
            <textarea value={finding} onChange={(e) => setFinding(e.target.value)} rows={3} className={textareaClass(!!errors.finding)} />
          </Field>

          <Section title="검사 요청" error={sectionError("exams")} onAdd={() => setAdding("exam")} addLabel="+ 검사 추가">
            {exams.length === 0 ? (
              <p className="text-body text-ink-sub">요청할 검사가 없으면 비워 둡니다.</p>
            ) : (
              exams.map((x) => (
                <Row key={x.examCode} onRemove={() => setExams((list) => list.filter((y) => y.examCode !== x.examCode))}>
                  <span className="text-item">
                    <span className="font-semibold">{x.examCode}</span> {x.name}
                  </span>
                </Row>
              ))
            )}
          </Section>

          <Section title="원내 처방" error={sectionError("prescriptions")} onAdd={() => setAdding("drug")} addLabel="+ 원내 처방">
            {drugs.length === 0 ? (
              <p className="text-body text-ink-sub">회진에서는 원내 처방만 합니다. 없으면 비워 둡니다.</p>
            ) : (
              drugs.map((item) => (
                <Row key={item.drugCode} onRemove={() => setDrugs((list) => list.filter((x) => x.drugCode !== item.drugCode))}>
                  <span className="flex flex-col">
                    <span className="text-item font-semibold">{item.name}</span>
                    <span className="text-caption text-ink-sub">
                      {item.dose}
                      {item.unit} × {item.timesPerDay}회 × {item.durationDays}일 · {item.instruction}
                    </span>
                  </span>
                </Row>
              ))
            )}
          </Section>

          <Button className="h-12 text-item" disabled={!canSave} onClick={() => save.mutate()}>
            {save.isPending ? "저장하는 중…" : "회진 기록 저장"}
          </Button>
          {isDoctor && !finding.trim() && <p className="-mt-3 text-caption text-ink-sub">소견을 입력해야 저장할 수 있습니다.</p>}
        </div>

        {/* 오른쪽: 이 입원의 지난 회진, 또는 검사·약품 추가 패널 */}
        {adding ? (
          <AddPanel
            mode={adding}
            showFees={false}
            dispenseTypes={["원내"]}
            dispenseType="원내"
            onDispenseType={() => {}}
            added={{ disease: [], drug: drugs.map((d) => d.drugCode), exam: exams.map((x) => x.examCode) }}
            onAddDisease={() => {}}
            onAddDrug={(item) => setDrugs((list) => [...list, item])}
            onAddExam={(x) => setExams((list) => [...list, x])}
            onClose={() => setAdding(null)}
          />
        ) : (
          <PastRounds admission={a} />
        )}
      </div>
    </>
  );
}

function PastRounds({ admission: a }: { admission: AdmissionDetail }) {
  return (
    <section className="self-start">
      <h2 className="mb-2 text-body font-bold text-ink-sub">이 입원의 지난 회진</h2>
      {a.rounds.length === 0 ? (
        <EmptyState title="아직 회진 기록이 없습니다" description="첫 회진을 저장하면 여기에 날짜순으로 쌓입니다." />
      ) : (
        <table className="w-full table-fixed text-left text-body break-keep">
          <colgroup>
            <col className="w-36" />
            <col className="w-20" />
            <col />
          </colgroup>
          <thead className="border-b border-sky text-caption text-ink-sub">
            <tr>
              <th className="px-2 py-2.5 font-semibold">일시</th>
              <th className="px-2 py-2.5 font-semibold">의사</th>
              <th className="px-2 py-2.5 font-semibold">소견</th>
            </tr>
          </thead>
          <tbody>
            {a.rounds.map((r) => (
              <tr key={r.encounterId} className="border-b border-skeleton">
                <td className="px-2 py-2.5 font-bold whitespace-nowrap text-ink">{shortDateTime(r.encounterAt)}</td>
                <td className="px-2 py-2.5">{r.doctorName}</td>
                <td className="px-2 py-2.5">{r.finding}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
