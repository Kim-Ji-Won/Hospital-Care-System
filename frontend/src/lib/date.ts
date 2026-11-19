/**
 * 날짜·시각 도구. API 값은 한국 시간 문자열입니다(README 값 표기).
 * DATETIME "2026-11-11T10:00:00", DATE "2026-11-11", TIME "09:00:00"
 */
import type { DayOfWeek } from "@/lib/api/types";

const DAYS: DayOfWeek[] = ["일", "월", "화", "수", "목", "금", "토"];

const pad = (n: number) => String(n).padStart(2, "0");

/** Date → "2026-11-11" (브라우저 지역 시간) */
export function toDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Date → "2026-11-11T10:00:00" */
export function toDateTime(d: Date) {
  return `${toDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export const today = () => toDate(new Date());
export const now = () => toDateTime(new Date());

/** "2026-11-11" 또는 "2026-11-11T10:00:00" → Date (지역 시간) */
export function parse(value: string) {
  const [d, t = "00:00:00"] = value.split("T");
  const [y, m, day] = d.split("-").map(Number);
  const [hh, mm, ss = 0] = t.split(":").map(Number);
  return new Date(y, m - 1, day, hh, mm, ss);
}

export function addDays(date: string, days: number) {
  const d = parse(date);
  d.setDate(d.getDate() + days);
  return toDate(d);
}

export function dayOfWeek(date: string): DayOfWeek {
  return DAYS[parse(date).getDay()];
}

/** "09:00:00" → "09:00" */
export const hm = (time: string) => time.slice(0, 5);

/** "2026-11-11T10:00:00" → "10:00" */
export const timeOf = (dateTime: string) => dateTime.slice(11, 16);

/** 올해가 아닌 날짜에만 연도를 붙임 (작년 기록이 올해 것처럼 읽히지 않게) */
const otherYear = (d: Date) => d.getFullYear() !== new Date().getFullYear();

/** "11. 11(수)", 올해가 아니면 "2025. 11. 11(화)" */
export function shortDate(value: string) {
  const d = parse(value);
  const year = otherYear(d) ? `${d.getFullYear()}. ` : "";
  return `${year}${d.getMonth() + 1}. ${pad(d.getDate())}(${DAYS[d.getDay()]})`;
}

/** "11. 11(수) 10:00" */
export const shortDateTime = (value: string) => `${shortDate(value)} ${timeOf(value)}`;

/** "11월 11일(수)", 올해가 아니면 "2025년 11월 11일(화)" */
export function longDate(value: string) {
  const d = parse(value);
  const year = otherYear(d) ? `${d.getFullYear()}년 ` : "";
  return `${year}${d.getMonth() + 1}월 ${d.getDate()}일(${DAYS[d.getDay()]})`;
}

/** 두 날짜 사이 일수(날짜만 비교). 입원 "D+6", 재원 일수에 씀 */
export function daysBetween(from: string, to: string = today()) {
  return Math.round((parse(to.slice(0, 10)).getTime() - parse(from.slice(0, 10)).getTime()) / 86_400_000);
}

/** datetime-local 입력칸 값 "2026-11-11T10:00" ↔ API "2026-11-11T10:00:00" */
export const toInputDateTime = (value: string) => value.slice(0, 16);
export const fromInputDateTime = (value: string) => (value.length === 16 ? `${value}:00` : value);

/** 만 나이 */
export function age(birthDate: string, on = today()) {
  const b = parse(birthDate);
  const t = parse(on);
  let a = t.getFullYear() - b.getFullYear();
  if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a -= 1;
  return a;
}

/** 38500 → "38,500원" */
export const won = (amount: number) => `${amount.toLocaleString("ko-KR")}원`;

/** #10234, #09412 */
export const patientNo = (id: number) => `#${String(id).padStart(5, "0")}`;
