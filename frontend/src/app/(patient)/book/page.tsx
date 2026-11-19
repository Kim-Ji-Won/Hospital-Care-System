"use client";

/**
 * P2 예약하기 — API 1-7, 2-1, 2-2, 2-3
 * 진료과 → 날짜 → 시간 → 증상 메모(선택) 순서로 고릅니다. 의사를 고르는 단계는 없습니다(서버가 무작위 배정).
 */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/client";
import { memberApi, memberKeys } from "@/lib/api/member";
import { reservationApi, reservationKeys } from "@/lib/api/reservation";
import { addDays, dayOfWeek, hm, parse, shortDate, today } from "@/lib/date";
import { QueryView } from "@/components/query-view";
import { Button, EmptyState, ErrorState, PageHeader, Skeleton, cx } from "@/components/ui";

const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"];

/** 이번 주 월요일 */
function mondayOf(date: string) {
  const offset = (parse(date).getDay() + 6) % 7;
  return addDays(date, -offset);
}

export default function BookPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const departments = useQuery({ queryKey: memberKeys.departments(), queryFn: memberApi.departments });

  const [departmentCode, setDepartmentCode] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState(() => mondayOf(today()));
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [note, setNote] = useState("");

  // 처음 들어오면 첫 진료과를 고른 상태로 시작
  const deptCode = departmentCode ?? departments.data?.[0]?.departmentCode ?? null;
  const dept = departments.data?.find((d) => d.departmentCode === deptCode);

  // 보이는 2주가 두 달에 걸칠 수 있어 달마다 2-1을 부름
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const months = [...new Set(days.map((d) => d.slice(0, 7)))];
  const dateQueries = useQueries({
    queries: months.map((month) => ({
      queryKey: reservationKeys.dates(deptCode ?? "", month),
      queryFn: () => reservationApi.bookingDates(deptCode!, month),
      enabled: !!deptCode,
    })),
  });
  const availableDates = new Set(dateQueries.flatMap((q) => q.data ?? []).filter((d) => d.available).map((d) => d.date));
  const datesLoading = dateQueries.some((q) => q.isPending);
  const selectedDate = date && availableDates.has(date) ? date : null;

  const slots = useQuery({
    queryKey: reservationKeys.slots(deptCode ?? "", selectedDate ?? ""),
    queryFn: () => reservationApi.bookingSlots(deptCode!, selectedDate!),
    enabled: !!deptCode && !!selectedDate,
  });
  const selectedSlot = slots.data?.find((s) => s.time === time && s.available) ? time : null;

  const create = useMutation({
    mutationFn: () =>
      reservationApi.create({ departmentCode: deptCode!, appointmentAt: `${selectedDate}T${selectedSlot}`, symptomNote: note.trim() || null }),
    onSuccess: (reservation) => {
      queryClient.invalidateQueries({ queryKey: reservationKeys.all });
      router.push(`/reservations?created=${reservation.reservationId}`);
    },
    onError: (error) => {
      // 그 사이 자리가 사라졌으면 시간표를 새로 받아 그 칸을 끔
      if (error instanceof ApiError && (error.code === "SLOT_TAKEN" || error.code === "PATIENT_TIME_CONFLICT")) {
        queryClient.invalidateQueries({ queryKey: reservationKeys.slots(deptCode ?? "", selectedDate ?? "") });
      }
    },
  });

  const nextAvailable = [...availableDates].filter((d) => d > (selectedDate ?? date ?? "")).sort()[0];

  function pickDepartment(code: string) {
    setDepartmentCode(code);
    setDate(null);
    setTime(null);
    create.reset();
  }

  return (
    <>
      <PageHeader title="진료 예약" />
      <QueryView query={departments} skeletonRows={4} errorTitle="진료과를 불러오지 못했습니다">
        {(list) => (
          <div className="grid grid-cols-[1fr_1fr] gap-10">
            {/* 왼쪽: 진료과, 날짜 */}
            <section className="flex flex-col gap-6">
              <div>
                <p className="mb-3 text-body font-bold text-ink-sub">진료과</p>
                <div className="flex flex-wrap gap-2">
                  {list.map((d) => (
                    <button
                      key={d.departmentCode}
                      type="button"
                      aria-pressed={d.departmentCode === deptCode}
                      onClick={() => pickDepartment(d.departmentCode)}
                      className={cx(
                        "h-10 rounded-full border px-4 text-body",
                        d.departmentCode === deptCode ? "border-navy bg-navy font-bold text-white" : "border-line bg-white text-ink hover:bg-select-bg",
                      )}
                    >
                      {d.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-body font-bold text-ink-sub">
                    날짜 · {parse(weekStart).getFullYear()}년 {parse(weekStart).getMonth() + 1}월
                  </p>
                  <div className="flex gap-1">
                    <Button variant="ghost" className="h-8 px-2" disabled={weekStart <= mondayOf(today())} onClick={() => setWeekStart(addDays(weekStart, -14))}>
                      ‹ 이전
                    </Button>
                    <Button variant="ghost" className="h-8 px-2" onClick={() => setWeekStart(addDays(weekStart, 14))}>
                      다음 ›
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-1.5 text-center">
                  {WEEKDAYS.map((w) => (
                    <span key={w} className="pb-1 text-caption text-ink-sub">
                      {w}
                    </span>
                  ))}
                  {days.map((d) => {
                    const open = availableDates.has(d);
                    const selected = d === selectedDate;
                    return (
                      <button
                        key={d}
                        type="button"
                        disabled={!open || datesLoading}
                        aria-pressed={selected}
                        aria-label={`${shortDate(d)} ${open ? "예약 가능" : "예약 불가"}`}
                        onClick={() => {
                          setDate(d);
                          setTime(null);
                          create.reset();
                        }}
                        className={cx(
                          "h-11 rounded-lg border text-item",
                          datesLoading && "animate-pulse border-skeleton bg-skeleton text-transparent",
                          !datesLoading && !open && "cursor-not-allowed border-skeleton bg-skeleton text-ink-sub",
                          !datesLoading && open && !selected && "border-line bg-white text-ink hover:bg-select-bg",
                          selected && "border-navy bg-navy font-bold text-white",
                        )}
                      >
                        {parse(d).getDate()}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-3 text-body text-ink-sub">회색 날짜는 {dept?.name ?? "이 진료과"} 진료가 없거나 자리가 찬 날입니다.</p>
              </div>
            </section>

            {/* 오른쪽: 시간, 메모, 요약 */}
            <section className="flex flex-col gap-5">
              <div>
                <p className="mb-3 text-body font-bold text-ink-sub">
                  {selectedDate ? `${parse(selectedDate).getDate()}일(${dayOfWeek(selectedDate)}) 시간` : "시간"}
                </p>
                {!selectedDate ? (
                  <EmptyState title="날짜를 먼저 고르세요" description="왼쪽 달력에서 진료 가능한 날짜를 누르면 시간이 나옵니다." />
                ) : slots.isPending ? (
                  <Skeleton rows={2} />
                ) : slots.isError ? (
                  <ErrorState title="시간을 불러오지 못했습니다" cause="잠시 뒤 다시 시도하세요." action={<Button variant="secondary" onClick={() => slots.refetch()}>다시 시도</Button>} />
                ) : slots.data.every((s) => !s.available) ? (
                  <EmptyState
                    title="이 날은 예약할 수 있는 시간이 없습니다"
                    action={nextAvailable && <Button variant="secondary" onClick={() => setDate(nextAvailable)}>다음 가능한 날({shortDate(nextAvailable)})로 이동</Button>}
                  />
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {slots.data.map((s) => {
                      const selected = s.time === selectedSlot;
                      return (
                        <button
                          key={s.time}
                          type="button"
                          disabled={!s.available}
                          aria-pressed={selected}
                          onClick={() => {
                            setTime(s.time);
                            create.reset();
                          }}
                          className={cx(
                            "flex h-12 flex-col items-center justify-center rounded-xl border text-item",
                            !s.available && "cursor-not-allowed border-skeleton bg-skeleton text-ink-sub",
                            s.available && !selected && "border-line bg-white text-ink hover:bg-select-bg",
                            selected && "border-navy bg-navy font-bold text-white",
                          )}
                        >
                          {hm(s.time)}
                          {s.mine && <span className="text-caption">내 예약 있음</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <label className="flex flex-col gap-2">
                <span className="text-body text-ink-sub">증상 메모 (선택)</span>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={500}
                  placeholder="예: 식후 속쓰림이 일주일째"
                  className="h-12 rounded-xl border border-line bg-white px-4 text-item outline-none placeholder:text-ink-sub/60 focus:border-navy"
                />
              </label>

              {create.isError && <ReservationError error={create.error} />}

              <div className="rounded-2xl border border-sky bg-select-bg px-5 py-4">
                <dl className="grid grid-cols-[1fr_auto] gap-y-1.5 text-item">
                  <dt className="text-ink-sub">진료과</dt>
                  <dd className="text-right">{dept?.name ?? "-"}</dd>
                  <dt className="text-ink-sub">일시</dt>
                  <dd className="text-right">{selectedDate && selectedSlot ? `${shortDate(selectedDate)} ${hm(selectedSlot)}` : "-"}</dd>
                  <dt className="text-ink-sub">담당 의사</dt>
                  <dd className="text-right">예약 후 배정</dd>
                </dl>
              </div>

              <Button className="h-12 text-item" disabled={!selectedDate || !selectedSlot || create.isPending} onClick={() => create.mutate()}>
                {create.isPending ? "예약하는 중…" : "예약하기"}
              </Button>
            </section>
          </div>
        )}
      </QueryView>
    </>
  );
}

function ReservationError({ error }: { error: Error }) {
  const code = error instanceof ApiError ? error.code : "";
  if (code === "SLOT_TAKEN") return <ErrorState title="방금 그 시간이 마감되었습니다" cause="다른 분이 먼저 예약했습니다. 시간표를 새로 불러왔으니 다른 시간을 고르세요." />;
  if (code === "PATIENT_TIME_CONFLICT") return <ErrorState title="같은 시간에 이미 예약이 있습니다" cause="한 시간에는 예약을 하나만 할 수 있습니다. 내 예약에서 확인하세요." />;
  if (code === "VALIDATION_FAILED") return <ErrorState title="예약할 수 없는 시간입니다" cause="지난 시간이거나 진료 시간이 아닙니다. 다른 시간을 고르세요." />;
  return <ErrorState title="예약하지 못했습니다" cause="서버와 연결되지 않았습니다. 고른 내용은 그대로 있으니 잠시 뒤 다시 시도하세요." />;
}
