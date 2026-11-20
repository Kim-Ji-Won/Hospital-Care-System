# 05 입·퇴원 관리

- **담당**: 김지원
- **시스템 구성도 05 영역**: 병실 현황 조회, 입원 등록, 퇴원 처리
- **관련 기준 정보**: 병실 관리 (시스템 구성도 07 영역 중 김지원님 담당 테이블)
- **관련 테이블**: admission(입원), room(병실)
- 공통 규칙은 [README](README.md)를 따릅니다. 퇴원 때 만드는 청구의 금액 계산은 [06-payment.md](06-payment.md#청구-금액-계산)에 있습니다.

| 번호 | 요청 | 권한 | 화면 | 순위 |
| --- | --- | --- | --- | --- |
| [5-1](#5-1-병실-현황) | `GET /api/rooms` | 의사·간호사 | S5, S5a, S8a | 2 |
| [5-2](#5-2-입원-배정-대기) | `GET /api/admissions/pending` | 의사·간호사 | S5, S5a | 2 |
| [5-3](#5-3-병실-배정입원-시작) | `POST /api/admissions` | 의사·간호사 | S5a | 2 |
| [5-4](#5-4-입원-목록) | `GET /api/admissions` | 의사·간호사 | S5, S5b | 2 |
| [5-5](#5-5-입원-한-건) | `GET /api/admissions/{admissionId}` | 의사·간호사 | S2b, S5b | 2 |
| [5-6](#5-6-퇴원-처리) | `POST /api/admissions/{admissionId}/discharge` | 의사·간호사 | S5b | 2 |
| [5-7](#5-7-내-입원-내역) | `GET /api/me/admissions` | 환자 | P1, P1a | 2 |
| [5-8](#5-8-병실-추가수정삭제) | `POST /api/rooms`, `PATCH·DELETE /api/rooms/{roomNo}` | 의사·간호사 | S8a | 3 |

## 입원 흐름

```text
S2 외래 진료에서 입원 결정 (3-1, admissionDecided: true, 결제 없음)
  → S5 배정 대기 (5-2)
  → S5a 병실·주치의 배정, 입원 시작 (5-3)
  → S2b 회진 기록 (3-1, 입원번호)
  → S5b 퇴원 처리 (5-6) → 입원 통합 청구 '미결제' 생성
  → S6 원무 수납 (6-2)
```

입원을 결정한 진료에는 입원 행이 바로 생기지 않습니다. 입원.병실번호·주치의번호·입원사유가 NOT NULL이라 병실을 정하는 5-3에서 입원 행을 만듭니다.

---

## 입원 객체

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `admissionId` | number | 입원번호 |
| `patient` | object | [환자 요약](README.md#공통-객체) |
| `decisionEncounterId` | number | 입원을 결정한 외래 진료 |
| `attendingId`, `attendingName` | number, string | 주치의 |
| `roomNo` | number | 병실번호 |
| `ward` | string | 병동. 예: "5층" |
| `admittedAt` | datetime | 입원일시 |
| `expectedDischargeDate` | date \| null | 퇴원예정일. null이면 화면에 "미정" |
| `dischargedAt` | datetime \| null | 퇴원일시. 입원 중이면 null |
| `reason` | string | 입원사유 |

```json
{
  "admissionId": 731,
  "patient": { "patientId": 8122, "name": "이정민", "birthDate": "1981-04-17", "gender": "남" },
  "decisionEncounterId": 5480,
  "attendingId": 12,
  "attendingName": "박지훈",
  "roomNo": 502,
  "ward": "5층",
  "admittedAt": "2026-11-05T10:20:00",
  "expectedDischargeDate": "2026-11-13",
  "dischargedAt": null,
  "reason": "급성 충수염 수술 후 관찰"
}
```

## 다른 담당자가 쓰는 기능

HTTP API가 아니라 백엔드 안에서 부르는 기능입니다.

| 기능 | 부르는 쪽 | 하는 일 |
| --- | --- | --- |
| 지금 입원 중인지 확인 | 박지수 (3-1 입원 결정) | 환자번호로 퇴원일시가 NULL인 입원을 찾아 돌려줌. 있으면 3-1이 `ALREADY_ADMITTED` |
| 회진용 입원 확인 | 박지수 (3-1 회진) | 입원번호로 환자번호(결정 진료의 환자), 입원일시, 퇴원일시를 돌려줌. 회진 일시가 입원 기간 안인지 검사하는 데 씀 |

---

## 5-1. 병실 현황

| 항목 | 내용 |
| --- | --- |
| 요청 | `GET /api/rooms` |
| 권한 | 의사·간호사 |
| 화면 | S5 병상 현황(사용/전체), S5a 빈 병상이 있는 병실, S8a 기준 정보: 병실 |
| 순위 | 2 |

**쿼리**

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `available` | boolean | | true면 빈 병상이 있는 병실만 (S5a) |

**응답 `200 OK`**: 병실번호 순

```json
[
  { "roomNo": 501, "ward": "5층", "bedCount": 4, "occupiedBeds": 2, "dailyFee": 60000 },
  { "roomNo": 503, "ward": "5층", "bedCount": 4, "occupiedBeds": 4, "dailyFee": 60000 },
  { "roomNo": 504, "ward": "5층", "bedCount": 2, "occupiedBeds": 0, "dailyFee": 90000 }
]
```

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `bedCount` | number | 병상수 |
| `occupiedBeds` | number | 퇴원일시가 NULL인 입원 수. 테이블에 없는 값 |
| `dailyFee` | number | 입원료(1일, 원). S5a는 병실 옆에 보여 줌 |

**오류**: 401, 403

---

## 5-2. 입원 배정 대기

| 항목 | 내용 |
| --- | --- |
| 요청 | `GET /api/admissions/pending` |
| 권한 | 의사·간호사 |
| 화면 | S5 배정 대기, S5a 머리 요약 |
| 순위 | 2 |

외래 진료에서 입원을 결정했지만 아직 병실을 배정하지 않은 환자입니다.

**응답 `200 OK`**: 입원 결정 시각 오름차순

```json
[
  {
    "decisionEncounterId": 5531,
    "decidedAt": "2026-11-11T09:40:00",
    "patient": { "patientId": 9412, "name": "김서현", "birthDate": "1968-11-02", "gender": "여" },
    "doctorId": 12,
    "doctorName": "박지훈",
    "departmentName": "내과"
  }
]
```

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `decisionEncounterId` | number | 입원을 결정한 진료 |
| `decidedAt` | datetime | 그 진료의 진료일시 |
| `doctorId`, `doctorName` | number, string | 입원을 결정한 의사. S5a 주치의 기본값 |

**오류**: 401, 403

**규칙**

- ERD에는 "입원 결정 후 배정 전" 상태를 담는 컬럼이 없습니다. ERD를 바꾸지 않고 **'취소'가 아닌 결제도 없고, 이 진료를 결정진료번호로 하는 입원도 없는 외래 진료**를 배정 대기로 봅니다. 일반 외래는 저장할 때 결제가 생기고(취소해도 새 미결제가 생김), 입원을 결정한 진료만 결제가 없기 때문입니다.

**백엔드 메모**

- 진료(외래) LEFT JOIN 결제(취소 제외) LEFT JOIN 입원(결정진료번호)에서 둘 다 없는 행입니다. 진료 쪽 조회는 박지수님 기능을 씁니다.
- 시드 데이터에 외래 진료를 넣을 때는 결제도 함께 넣어야 배정 대기에 잘못 나타나지 않습니다.

---

## 5-3. 병실 배정(입원 시작)

| 항목 | 내용 |
| --- | --- |
| 요청 | `POST /api/admissions` |
| 권한 | 의사·간호사 |
| 화면 | S5a 병실 배정 |
| 순위 | 2 |

배정 대기 환자에게 병실과 주치의를 정해 입원 행을 만듭니다. 버튼을 누른 시각이 입원일시입니다.

**요청 본문**

| 필드 | 타입 | 필수 | 규칙 |
| --- | --- | --- | --- |
| `decisionEncounterId` | number | O | 배정 대기인 외래 진료 |
| `roomNo` | number | O | 빈 병상이 있는 병실 |
| `attendingId` | number | O | 직종이 '의사'인 의료진. 화면 기본값은 입원을 결정한 의사 |
| `reason` | string | O | 1~500자 |
| `expectedDischargeDate` | date \| null | | 오늘 이후. 정할 수 없는 장기 입원은 null |

```json
{
  "decisionEncounterId": 5531,
  "roomNo": 501,
  "attendingId": 12,
  "reason": "폐렴 의심, 정맥 항생제 치료",
  "expectedDischargeDate": "2026-11-18"
}
```

**응답 `201 Created`**: [입원 객체](#입원-객체)

**오류**

| 상태 | code | 언제 |
| --- | --- | --- |
| 400 | `VALIDATION_FAILED` | 주치의가 의사가 아님, 사유가 없거나 500자 초과, 퇴원 예정일이 오늘 전 |
| 401, 403 | | 공통 |
| 404 | `NOT_FOUND` | 없는 진료·병실·의료진 |
| 409 | `INVALID_STATUS` | 그 진료가 배정 대기가 아님(이미 입원이 있음, 결제가 있는 일반 외래, 회진 진료) |
| 409 | `ROOM_FULL` | 그 사이에 병상이 다 찼음. S5는 병실 목록을 새로 받아 만실로 표시 |
| 409 | `ALREADY_ADMITTED` | 환자가 이미 입원 중. `details`에 `{ "admissionId": 731, "roomNo": 502, "admittedAt": "2026-11-05T10:20:00" }` |

**규칙**

- UNIQUE 결정진료번호: 진료 1건에 입원은 최대 1건입니다.
- 주치의번호가 가리키는 의료진의 직종이 '의사'여야 합니다.
- 빈 병상이 있어야 배정하고, 퇴원 전 재입원은 안 됩니다(퇴원일시가 NULL인 입원을 세어 비교).

**백엔드 메모**

- 업무분담서 완료 기준: 중복 입원과 병상 초과를 막습니다. 병실 행을 `SELECT … FOR UPDATE`로 잠근 뒤 입원 중 인원을 세고 INSERT 합니다. 같은 병실의 마지막 병상에 두 요청이 동시에 와도 한 건만 성공합니다.

---

## 5-4. 입원 목록

| 항목 | 내용 |
| --- | --- |
| 요청 | `GET /api/admissions?current=true` |
| 권한 | 의사·간호사 |
| 화면 | S5 입원 중 표, S5b 오늘 퇴원 예정 |
| 순위 | 2 |

**쿼리**

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `current` | boolean | | 기본 true(퇴원 전만). false면 퇴원한 입원도 포함 |

**응답 `200 OK`**: [입원 객체](#입원-객체)의 배열, 입원일시 오름차순. S5의 "D+6"과 S5b의 "오늘 퇴원 예정"은 프론트엔드가 계산합니다.

**오류**: 401, 403

---

## 5-5. 입원 한 건

| 항목 | 내용 |
| --- | --- |
| 요청 | `GET /api/admissions/{admissionId}` |
| 권한 | 의사·간호사 |
| 화면 | S2b 회진 기록(머리 요약, 이 입원의 지난 회진), S5b 퇴원 처리(요약) |
| 순위 | 2 |

**응답 `200 OK`**: [입원 객체](#입원-객체)에 회진 목록과 건수를 더한 것

```json
{
  "admissionId": 731,
  "patient": { "patientId": 8122, "name": "이정민", "birthDate": "1981-04-17", "gender": "남" },
  "decisionEncounterId": 5480,
  "attendingId": 12,
  "attendingName": "박지훈",
  "roomNo": 502,
  "ward": "5층",
  "admittedAt": "2026-11-05T10:20:00",
  "expectedDischargeDate": "2026-11-13",
  "dischargedAt": null,
  "reason": "급성 충수염 수술 후 관찰",
  "rounds": [
    { "encounterId": 5528, "encounterAt": "2026-11-10T08:30:00", "doctorId": 12, "doctorName": "박지훈", "finding": "배액량 감소, 식이 시작" },
    { "encounterId": 5512, "encounterAt": "2026-11-09T08:45:00", "doctorId": 15, "doctorName": "이도윤", "finding": "미열 37.6, 경과 관찰" }
  ],
  "summary": { "roundCount": 6, "examCount": 3, "inHousePrescriptionCount": 1 }
}
```

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `rounds` | array | 진료.입원번호가 이 입원인 회진 진료. 진료일시 내림차순 |
| `summary.roundCount` | number | 회진 수 |
| `summary.examCount` | number | 회진에서 요청한 검사 수 |
| `summary.inHousePrescriptionCount` | number | 회진의 원내 처방전 수 |

S5b는 이 건수를 보여 주며 "퇴원 뒤에는 회진을 추가할 수 없으니 지금 확인"하도록 안내합니다.

**오류**: 401, 403, 404

---

## 5-6. 퇴원 처리

| 항목 | 내용 |
| --- | --- |
| 요청 | `POST /api/admissions/{admissionId}/discharge` |
| 권한 | 의사·간호사 |
| 화면 | S5b 퇴원 처리 |
| 순위 | 2 |

퇴원일시를 기록하고, 입원을 결정한 진료에 입원 통합 청구('미결제')를 만듭니다. 한 트랜잭션입니다.

**요청 본문**

| 필드 | 타입 | 필수 | 규칙 |
| --- | --- | --- | --- |
| `dischargedAt` | datetime | O | 입원일시 이후, 지금 이전, 마지막 회진 일시 이후. 화면 기본값은 지금 |

```json
{ "dischargedAt": "2026-11-11T11:30:00" }
```

**응답 `200 OK`**

```json
{
  "admission": {
    "admissionId": 731,
    "patient": { "patientId": 8122, "name": "이정민", "birthDate": "1981-04-17", "gender": "남" },
    "decisionEncounterId": 5480,
    "attendingId": 12,
    "attendingName": "박지훈",
    "roomNo": 502,
    "ward": "5층",
    "admittedAt": "2026-11-05T10:20:00",
    "expectedDischargeDate": "2026-11-13",
    "dischargedAt": "2026-11-11T11:30:00",
    "reason": "급성 충수염 수술 후 관찰"
  },
  "payment": { "paymentId": 9120, "encounterId": 5480, "amount": 443700, "status": "미결제" }
}
```

**오류**

| 상태 | code | 언제 |
| --- | --- | --- |
| 400 | `VALIDATION_FAILED` | 퇴원일시가 입원일시보다 이르거나, 지금보다 늦거나, 마지막 회진보다 이름. `details`에 `{ "admittedAt": "…", "lastRoundAt": "…" }`. S5b는 두 시각을 나란히 보여 줌 |
| 401, 403 | | 공통 |
| 404 | `NOT_FOUND` | 없는 입원번호 |
| 409 | `ALREADY_DISCHARGED` | 이미 퇴원 처리됨. 청구를 다시 만들지 않음 |

**규칙**

- 결제는 자동 생성됩니다: 입원을 결정한 진료는 퇴원 처리할 때 '미결제'로 만듭니다. 금액은 [입원 산식](06-payment.md#청구-금액-계산)으로 계산합니다.
- 회진 일시는 입원 기간 안이어야 하므로, 이미 기록된 회진보다 이른 퇴원일시는 받지 않습니다.
- 퇴원일시가 채워지면 그 병실의 사용 병상 수가 바로 줄어듭니다.

**백엔드 메모**

- 업무분담서 완료 기준: 같은 퇴원 요청을 다시 보내도 청구가 중복되지 않아야 합니다. 입원 행을 `SELECT … FOR UPDATE`로 잠그고 퇴원일시가 이미 있으면 `ALREADY_DISCHARGED`를 돌려줍니다. 결제의 함수형 UNIQUE(진료마다 취소 아닌 결제 1건)도 마지막 안전장치가 됩니다.
- 당일 퇴원은 입원료 1일분입니다.

---

## 5-7. 내 입원 내역

| 항목 | 내용 |
| --- | --- |
| 요청 | `GET /api/me/admissions` |
| 권한 | 환자 |
| 화면 | P1 입원 카드, P1a 입원 내역 |
| 순위 | 2 |

로그인한 환자의 입원을 지금 입원과 지난 입원 모두 돌려줍니다. P6은 입원 중이면 "입원 진료비는 퇴원 후 한 번에 청구됩니다" 안내를 맨 위에 둡니다.

**응답 `200 OK`**: 입원일시 내림차순. [입원 객체](#입원-객체)에서 `patient`를 빼고 회진을 더한 모양입니다.

```json
[
  {
    "admissionId": 731,
    "decisionEncounterId": 5480,
    "attendingId": 12,
    "attendingName": "박지훈",
    "roomNo": 502,
    "ward": "5층",
    "admittedAt": "2026-11-05T10:20:00",
    "expectedDischargeDate": "2026-11-13",
    "dischargedAt": null,
    "reason": "급성 충수염 수술 후 관찰",
    "rounds": [
      { "encounterAt": "2026-11-10T08:30:00", "doctorName": "박지훈", "finding": "배액량 감소, 식이 시작" }
    ]
  }
]
```

**오류**: 401, 403(의료진이 호출)

**규칙**

- 입원에는 환자번호가 없습니다. 입원 → 결정진료번호 → 진료.환자번호로 로그인한 환자의 입원만 모읍니다.

---

## 5-8. 병실 추가·수정·삭제

| 항목 | 내용 |
| --- | --- |
| 요청 | `POST /api/rooms`, `PATCH /api/rooms/{roomNo}`, `DELETE /api/rooms/{roomNo}` |
| 권한 | 의사·간호사 |
| 화면 | S8a 기준 정보: 병실 |
| 순위 | 3 |

**추가 `POST` → `201 Created`**

| 필드 | 타입 | 필수 | 규칙 |
| --- | --- | --- | --- |
| `roomNo` | number | O | 1 이상 정수. 자동 증가가 아니라 사람이 입력. 예: 502 |
| `ward` | string | O | 1~20자. 예: 5층 |
| `bedCount` | number | O | 1 이상 정수 |
| `dailyFee` | number | O | 0 이상 정수(원) |

```json
{ "roomNo": 505, "ward": "5층", "bedCount": 2, "dailyFee": 90000 }
```

**수정 `PATCH` → `200 OK`**: `ward`, `bedCount`, `dailyFee` 중 고친 것만 보냅니다. 병실번호는 고칠 수 없습니다.

**삭제 `DELETE` → `204 No Content`**

응답 본문은 5-1의 항목 하나와 같은 모양입니다.

**오류**

| 상태 | code | 언제 |
| --- | --- | --- |
| 400 | `VALIDATION_FAILED` | 규칙 위반 |
| 401, 403 | | 공통 |
| 404 | `NOT_FOUND` | 없는 병실번호 |
| 409 | `CODE_TAKEN` | 같은 병실번호가 이미 있음 |
| 409 | `BED_COUNT_TOO_LOW` | 병상수를 입원 중 인원보다 적게 바꾸려 함. `details`에 `{ "occupiedBeds": 3 }`. S8a는 입력칸 아래에 하한을 미리 적어 둠 |
| 409 | `IN_USE` | 입원 기록이 있는 병실 삭제 |

**규칙**

- CHECK 병상수 > 0, 병상수를 입원 중 환자 수보다 줄일 수 없습니다.
- 입원료를 바꾸면 그 뒤에 만드는 청구부터 적용됩니다.
