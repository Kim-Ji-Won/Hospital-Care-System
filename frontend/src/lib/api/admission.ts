/** 05 입·퇴원 관리 (김지원) — docs/api/05-admission.md */
import { api } from "./client";
import type { Admission, AdmissionDetail, CreateAdmissionRequest, DateTime, DischargeResponse, MyAdmission, PendingAdmission, Room, RoomInput } from "./types";

export const admissionKeys = {
  all: ["admission"] as const,
  rooms: (available?: boolean) => [...admissionKeys.all, "rooms", available ? "available" : "all"] as const,
  pending: () => [...admissionKeys.all, "pending"] as const,
  list: (current = true) => [...admissionKeys.all, "list", current] as const,
  detail: (admissionId: number) => [...admissionKeys.all, "detail", admissionId] as const,
  mine: () => [...admissionKeys.all, "mine"] as const,
};

export const admissionApi = {
  /** 5-1 병실 현황 (available=true면 빈 병상이 있는 병실만) */
  rooms: (available?: boolean) => api.get<Room[]>("/api/rooms", { available: available ? true : undefined }),
  /** 5-2 입원 배정 대기 */
  pending: () => api.get<PendingAdmission[]>("/api/admissions/pending"),
  /** 5-3 병실 배정 (입원 시작) */
  create: (body: CreateAdmissionRequest) => api.post<Admission>("/api/admissions", body),
  /** 5-4 입원 목록 (기본: 퇴원 전만) */
  list: (current = true) => api.get<Admission[]>("/api/admissions", { current }),
  /** 5-5 입원 한 건 (회진 목록과 건수 포함) */
  detail: (admissionId: number) => api.get<AdmissionDetail>(`/api/admissions/${admissionId}`),
  /** 5-6 퇴원 처리 → 입원 통합 청구 '미결제' 생성 */
  discharge: (admissionId: number, dischargedAt: DateTime) => api.post<DischargeResponse>(`/api/admissions/${admissionId}/discharge`, { dischargedAt }),
  /** 5-7 내 입원 내역 */
  mine: () => api.get<MyAdmission[]>("/api/me/admissions"),
  /** 5-8 병실 추가·수정·삭제 */
  createRoom: (body: RoomInput) => api.post<Room>("/api/rooms", body),
  updateRoom: (roomNo: number, body: Partial<RoomInput>) => api.patch<Room>(`/api/rooms/${roomNo}`, body),
  deleteRoom: (roomNo: number) => api.delete(`/api/rooms/${roomNo}`),
};
