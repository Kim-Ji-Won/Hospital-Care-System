"use client";

/**
 * S2 진료 기록 작성 + S2a 진단·처방·검사 추가 — API 2-6, 1-6, 3-1, 4-5, 4-6, 4-7
 * 증상·소견·진단·처방·검사 요청·입원 결정을 한 화면에서 한 번에 저장합니다(주진단 1건은 등록 트랜잭션 안에서 확인).
 * 저장하면 예약이 '완료'가 되고, 입원 결정이 아니면 '미결제' 결제가 함께 만들어집니다. 의사는 금액을 다루지 않습니다.
 * 입력 부품은 components/encounter-parts.tsx에 있고 S2b 회진 기록이 함께 씁니다.
 */
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/client";
import { encounterApi, encounterKeys } from "@/lib/api/encounter";
import { memberApi, memberKeys } from "@/lib/api/member";
import { orderKeys } from "@/lib/api/order";
import { paymentKeys } from "@/lib/api/payment";
import { reservationApi, reservationKeys } from "@/lib/api/reservation";
import type { DispenseType, StaffReservation } from "@/lib/api/types";
import { useAuth } from "@/lib/auth";
import { shortDateTime, won } from "@/lib/date";
import { patientLine } from "@/components/patient-label";
import { Button, Card, Chip, EmptyState, ErrorState, PageHeader, Skeleton } from "@/components/ui";
import { AddPanel, Field, Row, Section, textareaClass, type Adding, type DrugDraft, type ExamDraft } from "@/components/encounter-parts";

interface DiagnosisDraft {
  diseaseCode: string;
  name: string;
  isPrimary: boolean;
}

export default function NewEncounterPage() {
  return (
    <Suspense fallback={<Skeleton rows={6} />}>
      <NewEncounter />
    </Suspense>
  );
}

function NewEncounter() {
  const reservationId = Number(useSearchParams().get("reservationId"));
  const reservation = useQuery({
    queryKey: reservationKeys.detail(reservationId),
    queryFn: () => reservationApi.detail(reservationId),
    enabled: reservationId > 0,
  });

  if (!reservationId) {
    return (
      <>
        <PageHeader title="진료 기록 작성" />
        <EmptyState
          title="진료할 예약을 먼저 고르세요"
          description="외래 진료 기록은 오늘 진료 목록에서 진료 시작을 눌러 엽니다."
          action={<Link href="/staff/today" className="font-semibold text-navy underline underline-offset-4">오늘 진료로 가기</Link>}
        />
      </>
    );
  }
  if (reservation.isPending) return <Skeleton rows={6} />;
  if (reservation.isError) {
    return (
      <ErrorState
        title="예약을 불러오지 못했습니다"
        cause={reservation.error instanceof ApiError && reservation.error.status === 404 ? "없는 예약번호입니다." : "잠시 뒤 다시 시도하세요."}
        action={<Link href="/staff/today" className="font-semibold text-error-ink underline">오늘 진료로 돌아가기</Link>}
      />
    );
  }
  if (reservation.data.status !== "예약") {
    return (
      <>
        <PageHeader title="진료 기록 작성" />
        <EmptyState
          title={`이 예약은 '${reservation.data.status}' 상태입니다`}
          description="진료 기록은 '예약' 상태인 예약에만 쓸 수 있습니다. 예약 1건에 진료는 1건입니다."
          action={<Link href="/staff/today" className="font-semibold text-navy underline underline-offset-4">오늘 진료로 돌아가기</Link>}
        />
      </>
    );
  }
  return <EncounterForm reservation={reservation.data} />;
}

function EncounterForm({ reservation }: { reservation: StaffReservation }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const patient = useQuery({ queryKey: memberKeys.patient(reservation.patient.patientId), queryFn: () => memberApi.patient(reservation.patient.patientId) });
  const admittedRoom = patient.data?.currentAdmission?.roomNo;

  const [symptom, setSymptom] = useState(reservation.symptomNote ?? "");
  const [finding, setFinding] = useState("");
  const [diagnoses, setDiagnoses] = useState<DiagnosisDraft[]>([]);
  const [prescriptions, setPrescriptions] = useState<Record<DispenseType, DrugDraft[]>>({ 원외: [], 원내: [] });
  const [exams, setExams] = useState<ExamDraft[]>([]);
  const [admissionDecided, setAdmissionDecided] = useState(false);
  const [adding, setAdding] = useState<Adding>(null);
  const [dispenseType, setDispenseType] = useState<DispenseType>("원외");

  const save = useMutation({
    mutationFn: () =>
      encounterApi.create({
        reservationId: reservation.reservationId,
        admissionId: null,
        encounterAt: null,
        symptom: symptom.trim() || null,
        finding: finding.trim(),
        diagnoses: diagnoses.map((d) => ({ diseaseCode: d.diseaseCode, isPrimary: d.isPrimary })),
        prescriptions: (["원외", "원내"] as const)
          .filter((t) => prescriptions[t].length > 0)
          .map((t) => ({
            dispenseType: t,
            items: prescriptions[t].map(({ drugCode, dose, timesPerDay, durationDays, instruction }) => ({ drugCode, dose, timesPerDay, durationDays, instruction })),
          })),
        exams: exams.map((x) => ({ examCode: x.examCode })),
        admissionDecided,
      }),
    onSuccess: () => {
      // 예약 '완료', 검사 '요청', 결제 '미결제'가 함께 바뀌므로 관련 목록을 다시 불러옴
      for (const key of [reservationKeys.all, orderKeys.all, paymentKeys.all, encounterKeys.all, memberKeys.all]) queryClient.invalidateQueries({ queryKey: key });
      router.push("/staff/today");
    },
  });

  const errors = save.error instanceof ApiError && save.error.code === "VALIDATION_FAILED" ? save.error.fieldMap() : {};
  const sectionError = (prefix: string) => Object.entries(errors).find(([k]) => k === prefix || k.startsWith(`${prefix}[`))?.[1];
  const canSave = finding.trim().length > 0 && diagnoses.length > 0 && !save.isPending;

  function addDisease(code: string, name: string) {
    setDiagnoses((list) => (list.some((d) => d.diseaseCode === code) ? list : [...list, { diseaseCode: code, name, isPrimary: list.length === 0 }]));
  }
  function removeDisease(code: string) {
    setDiagnoses((list) => {
      const next = list.filter((d) => d.diseaseCode !== code);
      // 주진단을 지우면 첫 줄이 주진단이 됨 (0건·2건이 되지 않게 라디오처럼)
      if (next.length > 0 && !next.some((d) => d.isPrimary)) next[0] = { ...next[0], isPrimary: true };
      return next;
    });
  }

  return (
    <>
      <PageHeader title="진료 기록 작성" sub={`${user?.name ?? ""} · ${shortDateTime(reservation.appointmentAt)} 예약`} />

      {/* 환자 요약 */}
      <Card className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 bg-select-bg">
        <p className="text-title font-bold text-ink">{reservation.patient.name}</p>
        <p className="text-body text-ink-sub">{patientLine(reservation.patient)}</p>
        <Chip>외래</Chip>
        <p className="text-body text-ink">예약 {shortDateTime(reservation.appointmentAt)}</p>
        <p className="text-body text-ink">메모 &ldquo;{reservation.symptomNote ?? "없음"}&rdquo;</p>
        {admittedRoom && <Chip>{`${admittedRoom}호 입원 중`}</Chip>}
      </Card>

      {save.isError && !Object.keys(errors).length && (
        <div className="mb-6">
          <ErrorState
            title="진료 기록을 저장하지 못했습니다"
            cause={
              save.error instanceof ApiError && save.error.code === "INVALID_STATUS"
                ? "이미 진료를 마쳤거나 취소·노쇼된 예약입니다. 오늘 진료 목록을 확인하세요."
                : save.error instanceof ApiError && save.error.code === "ALREADY_ADMITTED"
                  ? "이미 입원 중인 환자라 입원을 결정할 수 없습니다."
                  : "입력한 내용은 그대로 있으니 잠시 뒤 다시 저장하세요."
            }
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        {/* 왼쪽: 기록·진단 */}
        <div className="flex flex-col gap-5">
          <Field label="증상" error={errors.symptom}>
            <textarea value={symptom} onChange={(e) => setSymptom(e.target.value)} rows={3} className={textareaClass(!!errors.symptom)} placeholder="비워도 됩니다" />
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
            <textarea value={finding} onChange={(e) => setFinding(e.target.value)} rows={4} className={textareaClass(!!errors.finding)} />
          </Field>

          <Section title="진단" error={sectionError("diagnoses")} onAdd={() => setAdding("disease")} addLabel="+ 진단 추가">
            {diagnoses.length === 0 ? (
              <p className="text-body text-ink-sub">진단을 1건 이상 추가하세요. 처음 추가한 진단이 주진단이 됩니다.</p>
            ) : (
              diagnoses.map((d) => (
                <Row key={d.diseaseCode} onRemove={() => removeDisease(d.diseaseCode)}>
                  <span className="text-item">
                    <span className="font-semibold">{d.diseaseCode}</span> {d.name}
                  </span>
                  {d.isPrimary ? (
                    <Chip>주진단</Chip>
                  ) : (
                    <button
                      type="button"
                      className="text-caption font-semibold text-navy hover:underline"
                      onClick={() => setDiagnoses((list) => list.map((x) => ({ ...x, isPrimary: x.diseaseCode === d.diseaseCode })))}
                    >
                      주진단으로
                    </button>
                  )}
                </Row>
              ))
            )}
          </Section>
        </div>

        {/* 오른쪽: 처방·검사·입원, 또는 S2a 추가 패널 */}
        {adding ? (
          <AddPanel
            mode={adding}
            dispenseType={dispenseType}
            onDispenseType={setDispenseType}
            added={{
              disease: diagnoses.map((d) => d.diseaseCode),
              drug: prescriptions[dispenseType].map((d) => d.drugCode),
              exam: exams.map((x) => x.examCode),
            }}
            onAddDisease={addDisease}
            onAddDrug={(item) => setPrescriptions((p) => ({ ...p, [dispenseType]: [...p[dispenseType], item] }))}
            onAddExam={(x) => setExams((list) => [...list, x])}
            onClose={() => setAdding(null)}
          />
        ) : (
          <div className="flex flex-col gap-5">
            <Section title="처방" error={sectionError("prescriptions")} onAdd={() => setAdding("drug")} addLabel="+ 약품 추가">
              {prescriptions.원외.length + prescriptions.원내.length === 0 ? (
                <p className="text-body text-ink-sub">처방이 없으면 비워 둡니다.</p>
              ) : (
                (["원외", "원내"] as const).map((t) =>
                  prescriptions[t].map((item) => (
                    <Row key={`${t}-${item.drugCode}`} onRemove={() => setPrescriptions((p) => ({ ...p, [t]: p[t].filter((x) => x.drugCode !== item.drugCode) }))}>
                      <span className="flex flex-col">
                        <span className="text-item">
                          <Chip tone={t === "원내" ? "progress" : "void"}>{t}</Chip> <span className="font-semibold">{item.name}</span>
                        </span>
                        <span className="text-caption text-ink-sub">
                          {item.dose}
                          {item.unit} × {item.timesPerDay}회 × {item.durationDays}일 · {item.instruction}
                        </span>
                      </span>
                    </Row>
                  )),
                )
              )}
            </Section>

            <Section title="검사 요청" error={sectionError("exams")} onAdd={() => setAdding("exam")} addLabel="+ 검사 추가">
              {exams.length === 0 ? (
                <p className="text-body text-ink-sub">요청할 검사가 없으면 비워 둡니다.</p>
              ) : (
                exams.map((x) => (
                  <Row key={x.examCode} onRemove={() => setExams((list) => list.filter((y) => y.examCode !== x.examCode))}>
                    <span className="text-item">
                      <span className="font-semibold">{x.examCode}</span> {x.name}
                    </span>
                    <span className="text-body text-ink-sub">{won(x.fee)}</span>
                  </Row>
                ))
              )}
            </Section>

            <Section title="입원">
              {admittedRoom ? (
                <p className="text-body text-ink-sub">{admittedRoom}호에 입원 중이라 입원을 결정할 수 없습니다(퇴원 전 재입원 불가).</p>
              ) : (
                <label className="flex cursor-pointer items-start gap-3">
                  <input type="checkbox" checked={admissionDecided} onChange={(e) => setAdmissionDecided(e.target.checked)} className="mt-1 size-4 accent-[var(--color-navy)]" />
                  <span>
                    <span className="text-item font-semibold">입원 결정</span>
                    <span className="block text-caption text-ink-sub">병실 배정은 입원·병실 화면에서 합니다. 진료비는 퇴원 때 한 번에 청구됩니다.</span>
                  </span>
                </label>
              )}
            </Section>

            <Button className="h-12 text-item" disabled={!canSave} onClick={() => save.mutate()}>
              {save.isPending ? `저장하는 중… (진단 ${diagnoses.length} · 처방 ${prescriptions.원외.length + prescriptions.원내.length} · 검사 ${exams.length})` : "진료 기록 저장"}
            </Button>
            {!canSave && !save.isPending && <p className="-mt-3 text-caption text-ink-sub">소견과 진단 1건 이상이 있어야 저장할 수 있습니다.</p>}
          </div>
        )}
      </div>
    </>
  );
}
