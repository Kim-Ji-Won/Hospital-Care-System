"use client";

/**
 * S8 기준 정보 (+ S8a 질병·검사항목·병실, S8b 의료진 계정) — API 1-7, 1-8, 1-12 ~ 1-14, 4-5 ~ 4-10, 5-1, 5-8
 * 진료과·질병·약품·검사항목·병실·의료진을 탭으로 나눠 보고, 오른쪽 패널에서 추가·수정·삭제합니다.
 * 코드(PK)는 만든 뒤 잠그고, 진료·처방·검사·입원에 쓰인 행은 지우지 않습니다(기록 보관). 의료진은 삭제가 없습니다.
 */
import { useState } from "react";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { admissionApi, admissionKeys } from "@/lib/api/admission";
import { memberApi, memberKeys } from "@/lib/api/member";
import { orderApi, orderKeys } from "@/lib/api/order";
import type { Department, Disease, Drug, ExamItem, Room, Staff } from "@/lib/api/types";
import { won } from "@/lib/date";
import { MasterTable, type MasterConfig } from "@/components/master-table";
import { Button, PageHeader, cx } from "@/components/ui";

const TABS = [
  { slug: "departments", label: "진료과" },
  { slug: "diseases", label: "질병" },
  { slug: "drugs", label: "약품" },
  { slug: "exam-items", label: "검사항목" },
  { slug: "rooms", label: "병실" },
  { slug: "staff", label: "의료진" },
] as const;
type Slug = (typeof TABS)[number]["slug"];

const departments: MasterConfig<Department> = {
  noun: "진료과",
  queryKey: () => memberKeys.departments(),
  invalidate: memberKeys.all,
  list: () => memberApi.departments(),
  idOf: (r) => r.departmentCode,
  columns: [
    { label: "코드", className: "w-24", render: (r) => r.departmentCode },
    { label: "진료과명", render: (r) => r.name },
    { label: "위치", render: (r) => r.location ?? "없음" },
    { label: "전화", render: (r) => r.phone ?? "없음" },
    { label: "의료진", className: "w-20", render: (r) => `${r.staffCount}명` },
  ],
  fields: [
    { key: "departmentCode", label: "진료과코드", lockedOnEdit: true, placeholder: "예: IM", hint: "영문 대문자·숫자 1~10자" },
    { key: "name", label: "진료과명" },
    { key: "location", label: "위치", optional: true, placeholder: "예: 본관 2층" },
    { key: "phone", label: "전화", optional: true },
  ],
  toForm: (r) => ({ departmentCode: r.departmentCode, name: r.name, location: r.location ?? "", phone: r.phone ?? "" }),
  create: (b) => memberApi.createDepartment(b as never),
  update: (r, c) => memberApi.updateDepartment(r.departmentCode, c),
  remove: (r) => memberApi.deleteDepartment(r.departmentCode),
  removeBlocked: (r) => (r.staffCount > 0 ? `소속 의료진 ${r.staffCount}명이 있어 지울 수 없습니다.` : null),
};

const diseases: MasterConfig<Disease> = {
  noun: "질병",
  searchLabel: "질병명, 코드로 검색",
  queryKey: (q) => orderKeys.diseases(q),
  invalidate: orderKeys.all,
  list: (q) => orderApi.diseases(q),
  idOf: (r) => r.diseaseCode,
  columns: [
    { label: "코드", className: "w-28", render: (r) => r.diseaseCode },
    { label: "질병명", render: (r) => r.name },
    { label: "진단", className: "w-24", render: (r) => `${r.usageCount}건` },
  ],
  fields: [
    { key: "diseaseCode", label: "질병코드", lockedOnEdit: true, placeholder: "예: K35.8", hint: "영문·숫자·점 1~10자" },
    { key: "name", label: "질병명" },
  ],
  toForm: (r) => ({ diseaseCode: r.diseaseCode, name: r.name }),
  create: (b) => orderApi.createDisease(b as never),
  update: (r, c) => orderApi.updateDisease(r.diseaseCode, c),
  remove: (r) => orderApi.deleteDisease(r.diseaseCode),
  removeBlocked: (r) => (r.usageCount > 0 ? `진단 ${r.usageCount}건에 쓰여 지울 수 없습니다.` : null),
};

const drugs: MasterConfig<Drug> = {
  noun: "약품",
  searchLabel: "약품명, 코드, 성분으로 검색",
  queryKey: (q) => orderKeys.drugs(q),
  invalidate: orderKeys.all,
  list: (q) => orderApi.drugs(q),
  idOf: (r) => r.drugCode,
  columns: [
    { label: "코드", className: "w-20", render: (r) => r.drugCode },
    { label: "약품명", render: (r) => r.name },
    { label: "성분", render: (r) => r.ingredient ?? "없음" },
    { label: "제형", className: "w-20", render: (r) => r.form },
    { label: "단위", className: "w-20", render: (r) => r.unit },
    { label: "단가", className: "w-24", render: (r) => won(r.unitPrice) },
  ],
  fields: [
    { key: "drugCode", label: "약품코드", lockedOnEdit: true, placeholder: "예: D201" },
    { key: "name", label: "약품명" },
    { key: "ingredient", label: "성분", optional: true },
    { key: "form", label: "제형", placeholder: "예: 정제, 주사제" },
    { key: "unit", label: "단위", placeholder: "예: 정, 바이알" },
    { key: "unitPrice", label: "단가(원)", kind: "number" },
  ],
  toForm: (r) => ({ drugCode: r.drugCode, name: r.name, ingredient: r.ingredient ?? "", form: r.form, unit: r.unit, unitPrice: String(r.unitPrice) }),
  create: (b) => orderApi.createDrug(b as never),
  update: (r, c) => orderApi.updateDrug(r.drugCode, c),
  remove: (r) => orderApi.deleteDrug(r.drugCode),
  editNote: "단가를 바꾸면 그 뒤에 만드는 청구부터 적용됩니다. 이미 만든 청구 금액은 그대로입니다.",
};

const examItems: MasterConfig<ExamItem> = {
  noun: "검사항목",
  searchLabel: "검사명, 코드로 검색",
  queryKey: (q) => orderKeys.examItems(q),
  invalidate: orderKeys.all,
  list: (q) => orderApi.examItems(q),
  idOf: (r) => r.examCode,
  columns: [
    { label: "코드", className: "w-20", render: (r) => r.examCode },
    { label: "검사명", render: (r) => r.name },
    { label: "분류", className: "w-16", render: (r) => r.category },
    { label: "참고치", render: (r) => (r.referenceRange ? `${r.referenceRange} ${r.unit ?? ""}` : "없음") },
    { label: "검사비", className: "w-24", render: (r) => won(r.fee) },
  ],
  fields: [
    { key: "examCode", label: "검사코드", lockedOnEdit: true, placeholder: "예: L101" },
    { key: "name", label: "검사명" },
    { key: "category", label: "분류", kind: "choice", options: ["혈액", "영상", "기능"] },
    // 영상·기능은 수치 결과가 없으므로 참고치·단위가 없음
    { key: "referenceRange", label: "참고치", optional: true, placeholder: "예: 4.0~10.0", hidden: (f) => f.category !== "혈액" },
    { key: "unit", label: "단위", optional: true, placeholder: "예: mg/dL", hidden: (f) => f.category !== "혈액" },
    { key: "fee", label: "검사비(원)", kind: "number" },
  ],
  toForm: (r) => ({ examCode: r.examCode, name: r.name, category: r.category, referenceRange: r.referenceRange ?? "", unit: r.unit ?? "", fee: String(r.fee) }),
  create: (b) => orderApi.createExamItem(b as never),
  // 분류를 영상·기능으로 바꾸면 참고치·단위도 null로 함께 보냄 (4-10)
  update: (r, c) => orderApi.updateExamItem(r.examCode, c.category && c.category !== "혈액" ? { ...c, referenceRange: null, unit: null } : c),
  remove: (r) => orderApi.deleteExamItem(r.examCode),
  editNote: "검사비를 바꾸면 그 뒤에 만드는 청구부터 적용됩니다.",
};

const rooms: MasterConfig<Room> = {
  noun: "병실",
  queryKey: () => admissionKeys.rooms(),
  invalidate: admissionKeys.all,
  list: () => admissionApi.rooms(),
  idOf: (r) => r.roomNo,
  columns: [
    { label: "병실", className: "w-24", render: (r) => `${r.roomNo}호` },
    { label: "병동", render: (r) => r.ward },
    { label: "병상 (사용/전체)", render: (r) => `${r.occupiedBeds}/${r.bedCount}` },
    { label: "1일 입원료", render: (r) => won(r.dailyFee) },
  ],
  fields: [
    { key: "roomNo", label: "병실번호", kind: "number", lockedOnEdit: true, placeholder: "예: 505" },
    { key: "ward", label: "병동", placeholder: "예: 5층" },
    { key: "bedCount", label: "병상수", kind: "number", hint: "입원 중인 환자 수보다 적게 줄일 수 없습니다." },
    { key: "dailyFee", label: "1일 입원료(원)", kind: "number" },
  ],
  toForm: (r) => ({ roomNo: String(r.roomNo), ward: r.ward, bedCount: String(r.bedCount), dailyFee: String(r.dailyFee) }),
  create: (b) => admissionApi.createRoom(b as never),
  update: (r, c) => admissionApi.updateRoom(r.roomNo, c),
  remove: (r) => admissionApi.deleteRoom(r.roomNo),
  removeBlocked: (r) => (r.occupiedBeds > 0 ? `입원 중인 환자 ${r.occupiedBeds}명이 있어 지울 수 없습니다.` : null),
  editNote: "입원료를 바꾸면 그 뒤에 만드는 청구부터 적용됩니다.",
};

function staffConfig(depts: Department[]): MasterConfig<Staff> {
  return {
    noun: "의료진",
    queryKey: () => memberKeys.staff(),
    invalidate: memberKeys.all,
    list: () => memberApi.staff(),
    idOf: (r) => r.staffId,
    columns: [
      { label: "번호", className: "w-16", render: (r) => `#${r.staffId}` },
      { label: "이름", render: (r) => r.name },
      { label: "진료과", render: (r) => r.departmentName ?? "없음" },
      { label: "직종 · 직급", render: (r) => [r.jobType, r.position].filter(Boolean).join(" · ") },
      { label: "로그인 ID", render: (r) => r.loginId },
    ],
    fields: [
      { key: "name", label: "이름" },
      { key: "phone", label: "연락처", placeholder: "010-0000-0000" },
      { key: "jobType", label: "직종", kind: "choice", options: ["의사", "간호사", "원무"], lockedOnEdit: true },
      // 의사·간호사는 진료과 필수, 원무는 진료과 없음
      {
        key: "departmentCode",
        label: "진료과",
        kind: "choice",
        options: depts.map((d) => d.departmentCode),
        optionLabel: (code) => depts.find((d) => d.departmentCode === code)?.name ?? code,
        lockedOnEdit: true,
        hidden: (f) => f.jobType === "원무",
      },
      { key: "position", label: "직급", optional: true, placeholder: "예: 전문의" },
      { key: "loginId", label: "로그인 ID", lockedOnEdit: true, hint: "영문·숫자 4~20자" },
      { key: "password", label: "비밀번호 (본인이 직접 입력)", kind: "password", createOnly: true, hint: "영문과 숫자를 모두 넣어 8자 이상. 첫 로그인 뒤 바꾸는 단계는 없습니다." },
    ],
    toForm: (r) => ({ name: r.name, phone: r.phone, jobType: r.jobType, departmentCode: r.departmentCode ?? "", position: r.position ?? "", loginId: r.loginId, password: "" }),
    create: (b) => memberApi.createStaff({ ...b, departmentCode: b.jobType === "원무" ? null : (b.departmentCode ?? null) } as never),
    update: (r, c) => memberApi.updateStaff(r.staffId, c),
    // 일정·진료·검사·입원이 의료진을 참조하므로 삭제 없음
  };
}

export default function MasterPage() {
  const slug = useParams<{ tab: string }>().tab as Slug;
  const depts = useQuery({ queryKey: memberKeys.departments(), queryFn: memberApi.departments });
  const [adding, setAdding] = useState(false);
  const tab = TABS.find((t) => t.slug === slug);
  if (!tab) notFound();

  const config =
    slug === "departments" ? departments
    : slug === "diseases" ? diseases
    : slug === "drugs" ? drugs
    : slug === "exam-items" ? examItems
    : slug === "rooms" ? rooms
    : staffConfig(depts.data ?? []);

  return (
    <>
      <PageHeader
        title="기준 정보"
        actions={
          <Button className="h-9" onClick={() => setAdding(true)}>
            + {tab.label} 추가
          </Button>
        }
      />
      <nav aria-label="기준 정보 종류" className="mb-5 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.slug}
            href={`/staff/master/${t.slug}`}
            aria-current={t.slug === slug ? "page" : undefined}
            className={cx(
              "inline-flex h-9 items-center rounded-full border px-4 text-body",
              t.slug === slug ? "border-navy bg-navy font-bold text-white" : "border-line bg-white text-ink hover:bg-select-bg",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {/* 탭을 바꾸면 검색어·선택·패널을 처음부터 */}
      <MasterTable key={slug} config={config as MasterConfig<unknown>} addRequested={adding} onAddHandled={() => setAdding(false)} />
    </>
  );
}
