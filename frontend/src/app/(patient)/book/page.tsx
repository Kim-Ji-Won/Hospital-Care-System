"use client";

/**
 * P2 예약하기 — API 1-7, 2-1, 2-2, 2-3
 * 진료과 → 날짜 → 시간 → 증상 메모(선택) 순서로 고릅니다. 의사를 고르는 단계는 없습니다(서버가 무작위 배정).
 * 선택 화면은 P3a 시간 변경과 함께 쓰므로 components/booking-form.tsx에 있습니다.
 */
import { BookingForm } from "@/components/booking-form";

export default function BookPage() {
  return <BookingForm />;
}
