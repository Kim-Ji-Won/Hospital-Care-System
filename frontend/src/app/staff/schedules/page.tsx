"use client";

/**
 * S7 진료일정·휴진 + S7a 휴진 등록 + S7b 일정 수정·휴진 취소 — API 1-8, 2-10 ~ 2-17
 * 왼쪽은 의사의 매주 반복 일정(요일 × 오전·오후), 오른쪽 패널이 휴진 목록 → 휴진 등록 / 일정 수정 / 일정 추가로 바뀝니다.
 * 휴진을 등록하면 그날 예약을 같은 진료과·같은 시각의 빈 일정으로 옮기고, 없으면 취소하므로 확정 전에 영향을 미리 보여 줍니다.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/client";
import { memberApi, memberKeys } from "@/lib/api/member";
import { reservationApi, reservationKeys } from "@/lib/api/reservation";
import type { CreateDayOffResponse, DayOff, DayOfWeek, Schedule } from "@/lib/api/types";
import { useAuth } from "@/lib/auth";
import { addDays, dayOfWeek, hm, parse, shortDate, timeOf, today } from "@/lib/date";
import { QueryView } from "@/components/query-view";
import { Button, Chip, ConfirmDialog, ErrorState, PageHeader, Skeleton, cx } from "@/components/ui";

const DAYS: DayOfWeek[] = ["월", "화", "수", "목", "금", "토", "일"];
const DAY_NAME: Record<DayOfWeek, string> = { 월: "월요일", 화: "화요일", 수: "수요일", 목: "목요일", 금: "금요일", 토: "토요일", 일: "일요일" };
const inputClass = "h-11 w-full rounded-lg border border-line/60 bg-white px-3 text-item text-ink outline-none focus:border-navy";

type Panel = { kind: "list" } | { kind: "dayoff" } | { kind: "add" } | { kind: "edit"; scheduleId: number };

const isMorning = (s: Pick<Schedule, "startTime">) => s.startTime < "13:00";
/** "09:00:00" → "09", "09:30:00" → "09:30" */
const shortTime = (t: string) => (t.slice(3, 5) === "00" ? t.slice(0, 2) : hm(t));
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const fromMin = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
function slotsOf(start: string, end: string, minutes: number) {
  const out: string[] = [];
  if (!(minutes > 0)) return out;
  for (let m = toMin(start); m < toMin(end); m += minutes) out.push(fromMin(m));
  return out;
}

export default function SchedulesPage() {
  const { user } = useAuth();
  const doctors = useQuery({ queryKey: memberKeys.staff("의사"), queryFn: () => memberApi.staff("의사") });
  const [picked, setPicked] = useState<number | null>(null);
  const [panel, setPanel] = useState<Panel>({ kind: "list" });
  const [done, setDone] = useState<string | null>(null);

  // 의사는 처음에 본인, 간호사는 진료과의 첫 의사
  const doctorId =
    picked ?? (user?.role === "의사" ? user.staffId : (doctors.data?.find((d) => d.departmentCode === user?.departmentCode) ?? doctors.data?.[0])?.staffId) ?? null;
  const schedules = useQuery({ queryKey: reservationKeys.schedules(doctorId ?? 0), queryFn: () => reservationApi.schedules(doctorId!), enabled: !!doctorId });
  const dayOffs = useQuery({ queryKey: reservationKeys.dayOffs(doctorId ?? 0), queryFn: () => reservationApi.dayOffs(doctorId!, today()), enabled: !!doctorId });

  const back = (message?: string) => {
    setPanel({ kind: "list" });
    setDone(message ?? null);
  };

  return (
    <>
      <PageHeader
        title="진료일정·휴진"
        actions={
          <Button className="h-9" onClick={() => setPanel({ kind: "add" })} disabled={!doctorId}>
            + 일정 추가
          </Button>
        }
      />
      <label className="mb-5 flex flex-col gap-1.5">
        <span className="text-caption font-semibold text-ink-sub">의사</span>
        <select
          value={doctorId ?? ""}
          onChange={(e) => {
            setPicked(Number(e.target.value));
            back();
          }}
          className={inputClass}
        >
          {(doctors.data ?? []).map((d) => (
            <option key={d.staffId} value={d.staffId}>
              {d.name} · {d.departmentName}
            </option>
          ))}
        </select>
      </label>
      {done && (
        <div role="status" className="mb-5 rounded-xl border border-positive/30 bg-positive-bg px-5 py-3 text-body text-ink">
          {done}
        </div>
      )}

      <QueryView
        query={schedules}
        skeletonRows={4}
        errorTitle="진료일정을 불러오지 못했습니다"
        isEmpty={(list) => list.length === 0 && panel.kind !== "add"}
        empty={{
          title: "진료일정이 없습니다",
          description: "+ 일정 추가로 매주 반복되는 진료 시간을 만드세요. 일정이 있어야 환자가 그 시간에 예약할 수 있습니다.",
        }}
      >
        {(list) => (
          <div className="grid grid-cols-[1fr_300px] gap-6">
            <WeekGrid list={list} selectedId={panel.kind === "edit" ? panel.scheduleId : null} onSelect={(id) => setPanel({ kind: "edit", scheduleId: id })} />
            <div className="self-start">
              {panel.kind === "list" && <DayOffList list={dayOffs.data} schedules={list} loading={dayOffs.isPending} error={dayOffs.isError} onAdd={() => setPanel({ kind: "dayoff" })} />}
              {panel.kind === "dayoff" && <DayOffForm schedules={list} existing={dayOffs.data ?? []} onClose={back} />}
              {panel.kind === "add" && <ScheduleForm doctorId={doctorId!} onClose={back} />}
              {panel.kind === "edit" && list.some((s) => s.scheduleId === panel.scheduleId) && (
                <ScheduleForm
                  key={panel.scheduleId}
                  doctorId={doctorId!}
                  schedule={list.find((s) => s.scheduleId === panel.scheduleId)}
                  dayOffs={(dayOffs.data ?? []).filter((o) => o.scheduleId === panel.scheduleId)}
                  onClose={back}
                />
              )}
            </div>
          </div>
        )}
      </QueryView>
    </>
  );
}

/** 매주 반복 일정: 요일 × 오전·오후. 칸을 누르면 일정 수정 */
function WeekGrid({ list, selectedId, onSelect }: { list: Schedule[]; selectedId: number | null; onSelect: (id: number) => void }) {
  return (
    <section>
      <h2 className="mb-2 text-body font-bold text-ink-sub">매주 반복 (시간 · 예약 간격)</h2>
      <table className="w-full table-fixed text-center text-body">
        <colgroup>
          <col className="w-12" />
        </colgroup>
        <thead className="border-b border-sky text-caption text-ink-sub">
          <tr>
            <th><span className="sr-only">시간대</span></th>
            {DAYS.map((d) => (
              <th key={d} className="py-2.5 font-semibold">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(["오전", "오후"] as const).map((half) => (
            <tr key={half} className="border-b border-skeleton">
              <th className="py-1.5 text-left text-item font-bold text-ink">{half}</th>
              {DAYS.map((d) => (
                <td key={d} className="p-1 align-top">
                  {list
                    .filter((s) => s.dayOfWeek === d && isMorning(s) === (half === "오전"))
                    .map((s) => (
                      <button
                        key={s.scheduleId}
                        type="button"
                        onClick={() => onSelect(s.scheduleId)}
                        aria-pressed={s.scheduleId === selectedId}
                        className={cx(
                          "mb-1 flex w-full flex-col items-center rounded-lg py-1 text-caption font-medium",
                          s.scheduleId === selectedId ? "bg-navy text-white" : "bg-select-bg text-navy hover:bg-sky/40",
                        )}
                      >
                        <span className="sr-only">{d}요일 </span>
                        <span>
                          {shortTime(s.startTime)}~{shortTime(s.endTime)}
                        </span>
                        <span>{s.slotMinutes}분</span>
                        <span className="sr-only"> 간격, 일정 수정</span>
                      </button>
                    ))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/** 휴진을 날짜별로 묶음. 그날 요일의 일정이 모두 쉬면 "종일" */
function groupDayOffs(list: DayOff[], schedules: Schedule[]) {
  const byDate = new Map<string, DayOff[]>();
  for (const o of list) byDate.set(o.offDate, [...(byDate.get(o.offDate) ?? []), o]);
  return [...byDate.entries()].map(([date, offs]) => {
    const dow = dayOfWeek(date);
    const all = schedules.filter((s) => s.dayOfWeek === dow).length;
    const whole = offs.length >= all && all > 1;
    const label = whole ? "종일" : offs.map((o) => (isMorning(o) ? "오전" : "오후")).join("·");
    const detail = whole ? `${dow} 일정 ${offs.length}개` : offs.map((o) => `${dow} ${shortTime(o.startTime)}~${shortTime(o.endTime)} 일정`).join(", ");
    return { date, offs, label, detail, reason: offs[0].reason };
  });
}

function DayOffList({ list, schedules, loading, error, onAdd }: { list?: DayOff[]; schedules: Schedule[]; loading: boolean; error: boolean; onAdd: () => void }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-body font-bold text-ink-sub">휴진</h2>
      {loading ? (
        <Skeleton rows={2} />
      ) : error ? (
        <ErrorState title="휴진을 불러오지 못했습니다" cause="잠시 뒤 다시 시도하세요." />
      ) : list!.length === 0 ? (
        <p className="text-body text-ink-sub">앞으로 잡힌 휴진이 없습니다.</p>
      ) : (
        <ul className="flex flex-col">
          {groupDayOffs(list!, schedules).map((g) => (
            <li key={g.date} className="flex items-center justify-between border-b border-skeleton py-3">
              <div>
                <p className="text-title font-bold text-ink">
                  {shortDate(g.date)} {g.label}
                </p>
                <p className="text-body text-ink-sub">
                  {g.detail}
                  {g.reason && ` · ${g.reason}`}
                </p>
              </div>
              {g.date === today() ? <Chip tone="progress">오늘</Chip> : <Chip tone="void">예정</Chip>}
            </li>
          ))}
        </ul>
      )}
      <Button variant="secondary" onClick={onAdd}>
        + 휴진 등록
      </Button>
      <p className="text-caption text-ink-sub">일정을 고치거나 휴진을 취소하려면 왼쪽 시간표의 일정을 누르세요.</p>
    </section>
  );
}

/** S7a 휴진 등록: 일정(또는 그 요일 종일) → 날짜(그 요일만) → 사유. 확정 전에 그날 예약이 어떻게 되는지 미리 보여 줌 */
function DayOffForm({ schedules, existing, onClose }: { schedules: Schedule[]; existing: DayOff[]; onClose: (message?: string) => void }) {
  const queryClient = useQueryClient();
  // 일정 하나, 또는 요일 하나의 일정 전부(종일)
  const options = [
    ...schedules.map((s) => ({ value: `s${s.scheduleId}`, label: `${s.dayOfWeek} ${hm(s.startTime)}~${hm(s.endTime)}`, day: s.dayOfWeek, ids: [s.scheduleId] })),
    ...DAYS.filter((d) => schedules.filter((s) => s.dayOfWeek === d).length > 1).map((d) => ({
      value: `d${d}`,
      label: `${d} 종일 (일정 ${schedules.filter((s) => s.dayOfWeek === d).length}개)`,
      day: d,
      ids: schedules.filter((s) => s.dayOfWeek === d).map((s) => s.scheduleId),
    })),
  ];
  const [choice, setChoice] = useState(options[0]?.value ?? "");
  const [date, setDate] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const option = options.find((o) => o.value === choice);
  const ids = option?.ids ?? [];

  // 이번 주 월요일부터 3주, 그 요일이고 오늘보다 뒤인 날만
  const start = addDays(today(), -((parse(today()).getDay() + 6) % 7));
  const days = useMemo(() => Array.from({ length: 21 }, (_, i) => addDays(start, i)), [start]);
  const offDates = new Set(existing.filter((o) => ids.includes(o.scheduleId)).map((o) => o.offDate));
  const canPick = (d: string) => d > today() && dayOfWeek(d) === option?.day && !offDates.has(d);
  const selected = date && canPick(date) ? date : null;

  const impact = useQuery({
    queryKey: reservationKeys.impact(selected ?? "", ids),
    queryFn: () => reservationApi.dayOffImpact(selected!, ids),
    enabled: !!selected && ids.length > 0,
  });
  const create = useMutation({
    mutationFn: () => reservationApi.createDayOff({ scheduleIds: ids, offDate: selected!, reason: reason.trim() || null }),
    onSuccess: (r: CreateDayOffResponse) => {
      queryClient.invalidateQueries({ queryKey: reservationKeys.all });
      onClose(`${shortDate(selected!)} 휴진을 등록했습니다. 예약 ${r.reassigned.length}건을 옮기고 ${r.cancelled.length}건을 취소했습니다.`);
    },
  });

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-body font-bold text-ink-sub">휴진 등록</h2>
        <Button variant="ghost" className="h-8 px-2" onClick={() => onClose()}>
          닫기
        </Button>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-caption font-semibold text-ink-sub">일정</span>
        <select
          value={choice}
          onChange={(e) => {
            setChoice(e.target.value);
            setDate(null);
          }}
          className={inputClass}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <div>
        <p className="mb-1.5 text-caption font-semibold text-ink-sub">날짜 · {option ? `${DAY_NAME[option.day]}만 고를 수 있음` : ""}</p>
        <div className="grid grid-cols-7 gap-1 text-center">
          {DAYS.map((d) => (
            <span key={d} className="text-caption text-ink-sub">
              {d}
            </span>
          ))}
          {days.map((d) => {
            const open = canPick(d);
            return (
              <button
                key={d}
                type="button"
                disabled={!open}
                aria-pressed={d === selected}
                aria-label={`${shortDate(d)}${offDates.has(d) ? " 이미 휴진" : ""}`}
                onClick={() => setDate(d)}
                className={cx(
                  "h-9 rounded-lg text-body",
                  d === selected ? "bg-navy font-bold text-white" : open ? "border border-line bg-white text-ink hover:bg-select-bg" : "bg-skeleton text-ink-sub",
                  d === today() && d !== selected && "ring-1 ring-navy",
                )}
              >
                {parse(d).getDate()}
              </button>
            );
          })}
        </div>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-caption font-semibold text-ink-sub">사유 (선택)</span>
        <input value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} placeholder="예: 학회" className={inputClass} />
        <span className="text-caption text-ink-sub">사유는 의료진 화면에만 보이고 환자에게는 보이지 않습니다.</span>
      </label>

      {selected && (impact.isPending ? <Skeleton rows={2} /> : impact.isError ? <ErrorState title="영향을 계산하지 못했습니다" cause="잠시 뒤 다시 시도하세요." /> : <ImpactBox impact={impact.data} />)}
      {create.isError && (
        <ErrorState
          title="휴진을 등록하지 못했습니다"
          cause={create.error instanceof ApiError && create.error.code === "DAY_OFF_EXISTS" ? "그날 이미 휴진이 있습니다. 휴진 목록을 확인하세요." : "예약은 바뀌지 않았습니다. 잠시 뒤 다시 시도하세요."}
        />
      )}
      <Button className="h-11 text-item" disabled={!selected || impact.isPending || create.isPending} onClick={() => create.mutate()}>
        {create.isPending ? "등록하는 중…" : selected ? `${shortDate(selected)} 휴진 등록` : "날짜를 고르세요"}
      </Button>
    </section>
  );
}

function ImpactBox({ impact }: { impact: { reassigned: { appointmentAt: string; patient: { name: string }; toDoctorName: string }[]; cancelled: { appointmentAt: string; patient: { name: string } }[] } }) {
  const n = impact.reassigned.length + impact.cancelled.length;
  if (n === 0) return <p className="rounded-xl border border-sky bg-select-bg px-4 py-3 text-body text-ink">그날 잡힌 예약이 없어 바뀌는 예약이 없습니다.</p>;
  const doctors = [...new Set(impact.reassigned.map((r) => r.toDoctorName))].join("·");
  return (
    <div className="rounded-xl border border-sky bg-select-bg px-4 py-3">
      <p className="text-item font-bold text-navy">예약 {n}건이 바뀝니다</p>
      <p className="mt-1 text-body text-ink">
        {impact.reassigned.length > 0 && `${impact.reassigned.length}건은 같은 시각의 ${doctors} 일정으로 옮기고`}
        {impact.reassigned.length > 0 && impact.cancelled.length > 0 && ", "}
        {impact.cancelled.length > 0 &&
          `${impact.cancelled.map((c) => `${timeOf(c.appointmentAt)} ${c.patient.name} 님`).join(", ")} ${impact.cancelled.length}건은 옮길 곳이 없어 취소됩니다`}
        .
      </p>
    </div>
  );
}

/** S7b 일정 수정(시작·종료·간격) + 이 일정의 휴진 취소 + 일정 닫기, 또는 일정 추가(요일까지) */
function ScheduleForm({ doctorId, schedule: s, dayOffs = [], onClose }: { doctorId: number; schedule?: Schedule; dayOffs?: DayOff[]; onClose: (message?: string) => void }) {
  const queryClient = useQueryClient();
  const [day, setDay] = useState<DayOfWeek>(s?.dayOfWeek ?? "월");
  const [start, setStart] = useState(s ? hm(s.startTime) : "09:00");
  const [end, setEnd] = useState(s ? hm(s.endTime) : "12:00");
  const [slot, setSlot] = useState(String(s?.slotMinutes ?? 30));
  const [closing, setClosing] = useState(false);
  const [cancelling, setCancelling] = useState<DayOff | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: reservationKeys.all });

  const save = useMutation({
    mutationFn: () =>
      s
        ? reservationApi.updateSchedule(s.scheduleId, { startTime: `${start}:00`, endTime: `${end}:00`, slotMinutes: Number(slot) })
        : reservationApi.createSchedule({ doctorId, dayOfWeek: day, startTime: `${start}:00`, endTime: `${end}:00`, slotMinutes: Number(slot) }),
    onSuccess: () => {
      refresh();
      onClose(s ? "일정을 고쳤습니다." : `${day}요일 ${start}~${end} 일정을 만들었습니다.`);
    },
  });
  const close = useMutation({
    mutationFn: () => reservationApi.closeSchedule(s!.scheduleId),
    onSuccess: () => {
      setClosing(false);
      refresh();
      onClose("일정을 닫았습니다.");
    },
  });
  const cancelDayOff = useMutation({
    mutationFn: (o: DayOff) => reservationApi.cancelDayOff(o.dayOffId),
    onSuccess: () => {
      setCancelling(null);
      refresh();
    },
  });

  // 새로 열리거나 닫히는 예약 칸 (2-12: 새 칸은 프론트엔드가 계산)
  const before = s ? slotsOf(hm(s.startTime), hm(s.endTime), s.slotMinutes) : [];
  const after = start < end ? slotsOf(start, end, Number(slot)) : [];
  const opened = after.filter((t) => !before.includes(t));
  const removed = before.filter((t) => !after.includes(t));
  const changed = !s || hm(s.startTime) !== start || hm(s.endTime) !== end || s.slotMinutes !== Number(slot);
  const err = save.error instanceof ApiError ? save.error : null;
  const fields = err?.code === "VALIDATION_FAILED" ? err.fieldMap() : {};

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-body font-bold text-ink-sub">{s ? `일정 수정 · ${DAY_NAME[s.dayOfWeek]} ${isMorning(s) ? "오전" : "오후"}` : "일정 추가"}</h2>
        <Button variant="ghost" className="h-8 px-2" onClick={() => onClose()}>
          닫기
        </Button>
      </div>
      {!s && (
        <label className="flex flex-col gap-1.5">
          <span className="text-caption font-semibold text-ink-sub">요일</span>
          <select value={day} onChange={(e) => setDay(e.target.value as DayOfWeek)} className={inputClass}>
            {DAYS.map((d) => (
              <option key={d} value={d}>
                {DAY_NAME[d]}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-caption font-semibold text-ink-sub">시작</span>
          <input type="time" step={600} value={start} onChange={(e) => setStart(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-caption font-semibold text-ink-sub">종료</span>
          <input type="time" step={600} value={end} onChange={(e) => setEnd(e.target.value)} className={inputClass} />
        </label>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-caption font-semibold text-ink-sub">예약 간격</span>
        <select value={slot} onChange={(e) => setSlot(e.target.value)} className={inputClass}>
          {[10, 15, 20, 30, 40, 60].map((m) => (
            <option key={m} value={m}>
              {m}분
            </option>
          ))}
        </select>
      </label>
      {(fields.endTime || fields.startTime || fields.slotMinutes) && <p className="text-caption text-error-ink">{fields.endTime ?? fields.startTime ?? fields.slotMinutes}</p>}

      {s && changed && (opened.length > 0 || removed.length > 0) && (
        <div className="rounded-xl border border-sky bg-select-bg px-4 py-3">
          {opened.length > 0 && <p className="text-item font-bold text-navy">예약 칸 {opened.length}개가 새로 열립니다</p>}
          {removed.length > 0 && <p className="text-item font-bold text-navy">예약 칸 {removed.length}개가 닫힙니다</p>}
          <p className="mt-1 text-body text-ink">
            {[...opened, ...removed].slice(0, 6).join(", ")}
            {opened.length + removed.length > 6 && " 등"}. {removed.length > 0 ? "닫히는 칸에 앞으로의 예약이 있으면 저장되지 않습니다." : `이미 잡힌 예약 ${s.upcomingCount}건은 그대로입니다.`}
          </p>
        </div>
      )}
      {err && err.code !== "VALIDATION_FAILED" && (
        <ErrorState
          title="일정을 저장하지 못했습니다"
          cause={
            err.code === "SCHEDULE_OVERLAP"
              ? `같은 요일의 ${hm(String(err.details?.startTime))}~${hm(String(err.details?.endTime))} 일정과 시간이 겹칩니다.`
              : err.code === "RESERVATIONS_OUT_OF_RANGE"
                ? `앞으로의 예약 ${err.details?.count}건이 새 시간 밖으로 벗어납니다. 그 예약을 먼저 옮기거나 시간을 넓게 잡으세요.`
                : "잠시 뒤 다시 시도하세요."
          }
        />
      )}
      <Button className="h-11 text-item" disabled={!changed || save.isPending} onClick={() => save.mutate()}>
        {save.isPending ? "저장하는 중…" : s ? "일정 저장" : "일정 추가"}
      </Button>

      {s && (
        <>
          <h3 className="mt-3 text-body font-bold text-ink-sub">휴진</h3>
          {dayOffs.length === 0 ? (
            <p className="text-body text-ink-sub">이 일정에 잡힌 휴진이 없습니다.</p>
          ) : (
            <ul>
              {dayOffs.map((o) => (
                <li key={o.dayOffId} className="flex items-center justify-between border-b border-skeleton py-2.5">
                  <div>
                    <p className="text-item font-bold text-ink">{shortDate(o.offDate)}</p>
                    <p className="text-caption text-ink-sub">{o.reason ?? "사유 없음"}</p>
                  </div>
                  {o.offDate > today() && (
                    <Button variant="secondary" className="h-8 px-3" onClick={() => setCancelling(o)}>
                      휴진 취소
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {/* 예약이 RESTRICT로 일정을 참조: 한 번도 예약이 없을 때만 닫기 */}
          {s.reservationCount === 0 ? (
            <Button variant="ghost" className="self-start" onClick={() => setClosing(true)}>
              이 일정 닫기
            </Button>
          ) : (
            <p className="text-caption text-ink-sub">예약 기록이 {s.reservationCount}건 있어 닫을 수 없습니다. 시간을 고치세요.</p>
          )}
        </>
      )}

      <ConfirmDialog open={closing} title="이 일정을 닫을까요?" confirmLabel="일정 닫기" pending={close.isPending} onConfirm={() => close.mutate()} onCancel={() => setClosing(false)}>
        <p>매주 이 시간에는 더 이상 예약을 받지 않습니다. 이 일정의 휴진도 함께 지워집니다.</p>
        {close.isError && <p className="mt-2 text-error-ink">닫지 못했습니다. 그 사이에 예약이 생겼을 수 있습니다.</p>}
      </ConfirmDialog>
      <ConfirmDialog
        open={!!cancelling}
        title="휴진을 취소할까요?"
        confirmLabel="휴진 취소"
        cancelLabel="유지"
        pending={cancelDayOff.isPending}
        onConfirm={() => cancelling && cancelDayOff.mutate(cancelling)}
        onCancel={() => setCancelling(null)}
      >
        {cancelling && <p>{shortDate(cancelling.offDate)}에 다시 진료합니다. 휴진 때문에 이미 다른 의사로 옮겨지거나 취소된 예약은 돌아오지 않습니다.</p>}
        {cancelDayOff.isError && <p className="mt-2 text-error-ink">취소하지 못했습니다. 오늘이거나 지난 휴진은 취소할 수 없습니다.</p>}
      </ConfirmDialog>
    </section>
  );
}
