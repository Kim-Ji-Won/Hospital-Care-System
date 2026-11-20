/** 04 처방·검사 관리 (박지수) — docs/api/04-order.md */
import { api } from "./client";
import type { CompleteExamRequest, Disease, DiseaseInput, Drug, DrugInput, Exam, ExamItem, ExamItemInput, ExamStatus, MyExam } from "./types";

export const orderKeys = {
  all: ["order"] as const,
  exams: () => [...orderKeys.all, "exams"] as const,
  mine: () => [...orderKeys.all, "mine"] as const,
  diseases: (q: string) => [...orderKeys.all, "diseases", q] as const,
  drugs: (q: string) => [...orderKeys.all, "drugs", q] as const,
  examItems: (q: string) => [...orderKeys.all, "exam-items", q] as const,
};

export const orderApi = {
  /** 4-1 검사 목록 */
  exams: (status?: ExamStatus) => api.get<Exam[]>("/api/exams", { status }),
  /** 4-2 검사 시행 처리 */
  perform: (examId: number) => api.post<Exam>(`/api/exams/${examId}/perform`),
  /** 4-3 검사 결과·판독 입력 */
  complete: (examId: number, body: CompleteExamRequest) => api.post<Exam>(`/api/exams/${examId}/complete`, body),
  /** 4-4 내 검사 결과 */
  mine: () => api.get<MyExam[]>("/api/me/exams"),
  /** 4-5 질병 검색 */
  diseases: (q: string) => api.get<Disease[]>("/api/diseases", { q: q || undefined }),
  /** 4-6 약품 검색 */
  drugs: (q: string) => api.get<Drug[]>("/api/drugs", { q: q || undefined }),
  /** 4-7 검사항목 검색 */
  examItems: (q: string) => api.get<ExamItem[]>("/api/exam-items", { q: q || undefined }),
  /** 4-8 질병 추가·수정(이름만)·삭제 */
  createDisease: (body: DiseaseInput) => api.post<Disease>("/api/diseases", body),
  updateDisease: (code: string, body: Partial<DiseaseInput>) => api.patch<Disease>(`/api/diseases/${encodeURIComponent(code)}`, body),
  deleteDisease: (code: string) => api.delete(`/api/diseases/${encodeURIComponent(code)}`),
  /** 4-9 약품 추가·수정·삭제 */
  createDrug: (body: DrugInput) => api.post<Drug>("/api/drugs", body),
  updateDrug: (code: string, body: Partial<DrugInput>) => api.patch<Drug>(`/api/drugs/${code}`, body),
  deleteDrug: (code: string) => api.delete(`/api/drugs/${code}`),
  /** 4-10 검사항목 추가·수정·삭제 */
  createExamItem: (body: ExamItemInput) => api.post<ExamItem>("/api/exam-items", body),
  updateExamItem: (code: string, body: Partial<ExamItemInput>) => api.patch<ExamItem>(`/api/exam-items/${code}`, body),
  deleteExamItem: (code: string) => api.delete(`/api/exam-items/${code}`),
};
