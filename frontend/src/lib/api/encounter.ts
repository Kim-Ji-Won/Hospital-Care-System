/** 03 진료 관리 (박지수) — docs/api/03-encounter.md */
import { api } from "./client";
import type { CreateEncounterRequest, CreateEncounterResponse, EncounterDetail } from "./types";

export const encounterKeys = {
  all: ["encounter"] as const,
  mine: () => [...encounterKeys.all, "mine"] as const,
};

export const encounterApi = {
  /** 3-1 진료 기록 저장 (외래·회진) */
  create: (body: CreateEncounterRequest) => api.post<CreateEncounterResponse>("/api/encounters", body),
  /** 3-2 내 진료 기록 */
  mine: () => api.get<EncounterDetail[]>("/api/me/encounters"),
};
