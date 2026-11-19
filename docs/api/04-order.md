# 04 처방·검사 관리

- **담당**: 박지수
- **시스템 구성도 04 영역**: 검사 결과 입력, 검사 결과 조회. 처방 등록과 검사 요청은 진료와 함께 [3-1](03-encounter.md#3-1-진료-기록-저장)에서 저장합니다.
- **관련 기준 정보**: 질병, 약품, 검사항목 관리 (시스템 구성도 07 영역 중 박지수님 담당 테이블)
- **관련 테이블**: exam(검사), disease(질병), drug(약품), exam_item(검사항목)
- 공통 규칙은 [README](README.md)를 따릅니다.

| 번호 | 요청 | 권한 | 화면 | 순위 |
| --- | --- | --- | --- | --- |
| [4-1](#4-1-검사-목록) | `GET /api/exams` | 의사·간호사 | S4 | 1 |
| [4-2](#4-2-검사-시행-처리) | `POST /api/exams/{examId}/perform` | 의사·간호사 | S4 | 1 |
| [4-3](#4-3-검사-결과판독-입력) | `POST /api/exams/{examId}/complete` | 의사 | S4a | 1 |
| [4-4](#4-4-내-검사-결과) | `GET /api/me/exams` | 환자 | P1, P5 | 1 |
| [4-5](#4-5-질병-검색) | `GET /api/diseases` | 의사·간호사 | S2a, S8a | 1 |
| [4-6](#4-6-약품-검색) | `GET /api/drugs` | 의사·간호사 | S2a, S8 | 1 |
| [4-7](#4-7-검사항목-검색) | `GET /api/exam-items` | 의사·간호사 | S2a, S8a | 1 |
| [4-8](#4-8-질병-추가수정삭제) | `POST /api/diseases`, `PATCH·DELETE /api/diseases/{diseaseCode}` | 의사·간호사 | S8a | 3 |
| [4-9](#4-9-약품-추가수정삭제) | `POST /api/drugs`, `PATCH·DELETE /api/drugs/{drugCode}` | 의사·간호사 | S8 | 3 |
| [4-10](#4-10-검사항목-추가수정삭제) | `POST /api/exam-items`, `PATCH·DELETE /api/exam-items/{examCode}` | 의사·간호사 | S8a | 3 |

---

## 검사 객체

의료진 화면(4-1, 4-2, 4-3)이 쓰는 검사 한 건입니다.

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `examId` | number | 검사번호 |
| `status` | `'요청' \| '시행' \| '완료'` | 검사상태 |
| `examCode`, `examName` | string, string | 검사코드, 검사명 |
| `category` | `'혈액' \| '영상' \| '기능'` | 검사분류 |
| `referenceRange` | string \| null | 참고치. 예: "4.0~10.0". 영상·기능은 null |
| `unit` | string \| null | 단위. 예: "×10³/µL" |
| `patient` | object | [환자 요약](README.md#공통-객체) |
| `encounterId` | number | 검사를 요청한 진료 |
| `requestDoctorId`, `requestDoctorName` | number, string | 요청한 진료의 의사. S4 "10:18 박지훈" |
| `requestedAt` | datetime | 요청일시 |
| `performedAt` | datetime \| null | 시행일시. '시행'·'완료'면 있음 |
| `resultValue` | number \| null | 결과값. 영상·기능은 '완료'여도 null |
| `resultFlag` | `'정상' \| '이상'` \| null | 판정. '완료'면 있음 |
| `readingNote` | string \| null | 판독소견. '완료'면 있음 |
| `readerId`, `readerName` | number \| null, string \| null | 판독자. '완료'면 있음 |

```json
{
  "examId": 3301,
  "status": "시행",
  "examCode": "L101",
  "examName": "일반혈액검사",
  "category": "혈액",
  "referenceRange": "4.0~10.0",
  "unit": "×10³/µL",
  "patient": { "patientId": 10234, "name": "김서연", "birthDate": "1994-03-12", "gender": "여" },
  "encounterId": 5530,
  "requestDoctorId": 12,
  "requestDoctorName": "박지훈",
  "requestedAt": "2026-11-11T10:18:00",
  "performedAt": "2026-11-11T10:35:00",
  "resultValue": null,
  "resultFlag": null,
  "readingNote": null,
  "readerId": null,
  "readerName": null
}
```

---

## 4-1. 검사 목록

| 항목 | 내용 |
| --- | --- |
| 요청 | `GET /api/exams?status=요청` |
| 권한 | 의사·간호사 |
| 화면 | S4 검사 (요청·시행·완료 탭) |
| 순위 | 1 |

로그인한 의료진의 진료과에서 요청된 검사를 돌려줍니다(요청한 진료의 의사 진료과 기준). 탭 위의 건수는 프론트엔드가 상태 없이 불러와 셉니다.

**쿼리**

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `status` | `'요청' \| '시행' \| '완료'` | | 이 상태만. 없으면 전부 |

**응답 `200 OK`**: [검사 객체](#검사-객체)의 배열, 요청일시 오름차순

**오류**: 400(`status`가 다른 값), 401, 403(환자·원무가 호출)

---

## 4-2. 검사 시행 처리

| 항목 | 내용 |
| --- | --- |
| 요청 | `POST /api/exams/{examId}/perform` |
| 권한 | 의사·간호사 |
| 화면 | S4 요청 탭의 "시행 처리" |
| 순위 | 1 |

요청 본문은 없습니다. 상태를 '요청'에서 '시행'으로 바꾸고, 시행일시를 누른 시각으로 넣습니다. 입력 폼은 없습니다.

**응답 `200 OK`**: 바뀐 [검사 객체](#검사-객체)

**오류**: 401, 403, 404, 409 `INVALID_STATUS`(상태가 '요청'이 아님)

**규칙**

- 상태는 요청 → 시행 → 완료 순서로만 바뀝니다.
- CHECK 상태 = '요청' OR 시행일시 IS NOT NULL

---

## 4-3. 검사 결과·판독 입력

| 항목 | 내용 |
| --- | --- |
| 요청 | `POST /api/exams/{examId}/complete` |
| 권한 | 의사 |
| 화면 | S4a 검사 결과·판독 입력 |
| 순위 | 1 |

결과값과 판정·판독소견을 넣고 상태를 '시행'에서 '완료'로 바꿉니다. 판독자는 로그인한 의사입니다. 완료되면 환자에게 바로 공개되므로 화면은 누르기 전에 확인을 한 번 받습니다.

**요청 본문**

| 필드 | 타입 | 필수 | 규칙 |
| --- | --- | --- | --- |
| `resultValue` | number \| null | | 검사분류가 '혈액'일 때만. 소수 둘째 자리까지, ±99,999,999.99 이내. 영상·기능은 null이어야 함 |
| `resultFlag` | `'정상' \| '이상'` | O | 결과값이 참고치를 벗어나면 화면이 '이상'을 미리 골라 두지만, 최종 선택은 의사 |
| `readingNote` | string | O | 1~2,000자 |

```json
{
  "resultValue": 11.8,
  "resultFlag": "이상",
  "readingNote": "경미한 백혈구 증가. 염증 반응 의심, 2주 뒤 재검 권장."
}
```

**응답 `200 OK`**: 바뀐 [검사 객체](#검사-객체)

**오류**

| 상태 | code | 언제 |
| --- | --- | --- |
| 400 | `VALIDATION_FAILED` | 판정·판독소견이 없음, 영상·기능 검사에 결과값을 넣음, 결과값 범위 초과 |
| 401 | `UNAUTHENTICATED` | |
| 403 | `FORBIDDEN` | 의사가 아님 |
| 404 | `NOT_FOUND` | 없는 검사번호 |
| 409 | `INVALID_STATUS` | 상태가 '시행'이 아님. 다른 의사가 먼저 판독해 이미 '완료'면 `details`에 `{ "readerName": "이도윤" }`. S4a는 입력하던 글을 지우지 않음 |

**규칙**

- CHECK 상태 <> '완료' OR (판정, 판독소견, 판독자번호 모두 NOT NULL). 업무분담서 완료 기준: 판독 정보가 빠지면 저장을 거절합니다.
- 상태는 요청 → 시행 → 완료 순서로만 바뀌고, 완료 뒤에는 고치는 API가 없습니다.
- 영상·기능 검사는 완료여도 결과값이 NULL입니다.

**백엔드 메모**

- 두 사람이 같은 검사를 동시에 완료하지 않도록 `UPDATE … WHERE exam_id = ? AND status = '시행'`처럼 상태 조건을 걸고, 바뀐 행이 0이면 `INVALID_STATUS`를 돌려줍니다.

---

## 4-4. 내 검사 결과

| 항목 | 내용 |
| --- | --- |
| 요청 | `GET /api/me/exams` |
| 권한 | 환자 |
| 화면 | P1 새 검사 결과, P5 검사 결과 |
| 순위 | 1 |

로그인한 환자의 검사 중 **'완료'만** 돌려줍니다.

**응답 `200 OK`**: 시행일시 내림차순

```json
[
  {
    "examId": 3290,
    "examCode": "L101",
    "examName": "일반혈액검사",
    "category": "혈액",
    "referenceRange": "4.0~10.0",
    "unit": "×10³/µL",
    "resultValue": 11.8,
    "resultFlag": "이상",
    "readingNote": "경미한 백혈구 증가. 염증 반응 의심, 2주 뒤 재검 권장.",
    "readerName": "박지훈",
    "performedAt": "2026-10-29T14:20:00",
    "encounterId": 5521,
    "encounterAt": "2026-10-28T09:35:00"
  },
  {
    "examId": 3295,
    "examCode": "R202",
    "examName": "복부 CT",
    "category": "영상",
    "referenceRange": null,
    "unit": null,
    "resultValue": null,
    "resultFlag": "정상",
    "readingNote": "특이 소견 없음.",
    "readerName": "이도윤",
    "performedAt": "2026-10-30T11:00:00",
    "encounterId": 5521,
    "encounterAt": "2026-10-28T09:35:00"
  }
]
```

- P5는 수치가 있으면 참고치 막대를, 없으면 판독소견을 본문으로 보여 줍니다.
- 판독한 시각은 따로 저장하지 않으므로 화면의 날짜는 `performedAt`(시행일시)을 씁니다.

**오류**: 401, 403(의료진이 호출)

**규칙**

- 환자에게는 '완료' 검사만 보여 줍니다. 요청·시행 단계 검사는 목록에도, 건수에도 나오지 않습니다.
- 검사에는 환자번호가 없습니다. 검사 → 진료 → 환자번호로 찾습니다.

---

## 4-5. 질병 검색

| 항목 | 내용 |
| --- | --- |
| 요청 | `GET /api/diseases?q=위` |
| 권한 | 의사·간호사 |
| 화면 | S2a 진단 추가, S8a 기준 정보: 질병 |
| 순위 | 1 |

**쿼리**

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `q` | string | | 질병코드로 시작하거나 질병명에 들어간 것. 없으면 전부 |

**응답 `200 OK`**: 질병코드 순

```json
[
  { "diseaseCode": "K21.0", "name": "역류성 식도염", "usageCount": 131 },
  { "diseaseCode": "K29.7", "name": "위염", "usageCount": 214 }
]
```

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `usageCount` | number | 진단에 쓰인 횟수. 테이블에 없는 값으로, S8a에서 삭제할 수 있는지 미리 보여 주는 데 씀 |

**오류**: 401, 403

**규칙**

- 진단.질병코드는 질병의 FK라 직접 입력을 받지 않고 검색 결과에서만 고릅니다. 이미 넣은 질병은 화면이 "추가됨"으로 막습니다.

---

## 4-6. 약품 검색

| 항목 | 내용 |
| --- | --- |
| 요청 | `GET /api/drugs?q=세프` |
| 권한 | 의사·간호사 |
| 화면 | S2a 처방 추가, S8 기준 정보: 약품 |
| 순위 | 1 |

**쿼리**

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `q` | string | | 약품명·약품코드·성분에 들어간 것. 없으면 전부 |

**응답 `200 OK`**: 약품코드 순

```json
[
  { "drugCode": "D550", "name": "세프트리악손주 1g", "ingredient": "세프트리악손", "form": "주사제", "unit": "바이알", "unitPrice": 4200 },
  { "drugCode": "D551", "name": "세프라딘캡슐 500mg", "ingredient": "세프라딘", "form": "캡슐", "unit": "캡슐", "unitPrice": 240 }
]
```

- S2a는 고른 약의 `unit`으로 1회 투여량 칸 이름을 바꾸고("1회 투여량 (바이알)"), 원내 처방은 진료비에 들어가므로 `unitPrice`를 함께 보여 줍니다.

**오류**: 401, 403

---

## 4-7. 검사항목 검색

| 항목 | 내용 |
| --- | --- |
| 요청 | `GET /api/exam-items?q=X선` |
| 권한 | 의사·간호사 |
| 화면 | S2a 검사 추가, S8a 기준 정보: 검사항목 |
| 순위 | 1 |

**쿼리**

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `q` | string | | 검사명·검사코드에 들어간 것. 없으면 전부 |

**응답 `200 OK`**: 검사코드 순

```json
[
  { "examCode": "L101", "name": "일반혈액검사", "category": "혈액", "referenceRange": "4.0~10.0", "unit": "×10³/µL", "fee": 8000 },
  { "examCode": "R201", "name": "흉부 X선", "category": "영상", "referenceRange": null, "unit": null, "fee": 15500 }
]
```

**오류**: 401, 403

---

## 4-8. 질병 추가·수정·삭제

| 항목 | 내용 |
| --- | --- |
| 요청 | `POST /api/diseases`, `PATCH /api/diseases/{diseaseCode}`, `DELETE /api/diseases/{diseaseCode}` |
| 권한 | 의사·간호사 |
| 화면 | S8a 기준 정보: 질병 |
| 순위 | 3 |

**추가 `POST` → `201 Created`**

| 필드 | 타입 | 필수 | 규칙 |
| --- | --- | --- | --- |
| `diseaseCode` | string | O | 1~10자, 영문·숫자·점. 예: K35.8 |
| `name` | string | O | 1~100자 |

```json
{ "diseaseCode": "J18.9", "name": "상세불명의 폐렴" }
```

**수정 `PATCH` → `200 OK`**: `name`만 고칠 수 있습니다.

**삭제 `DELETE` → `204 No Content`**

응답 본문은 4-5의 항목 하나와 같은 모양입니다.

**오류**: 400, 401, 403, 404(없는 코드), 409 `CODE_TAKEN`(추가), 409 `IN_USE`(진단에 쓰인 질병 삭제, `details.count`에 건수)

**규칙**: 질병코드는 PK이면서 진단의 FK라 만든 뒤에는 잠급니다. 참조 중이면 삭제할 수 없습니다.

---

## 4-9. 약품 추가·수정·삭제

| 항목 | 내용 |
| --- | --- |
| 요청 | `POST /api/drugs`, `PATCH /api/drugs/{drugCode}`, `DELETE /api/drugs/{drugCode}` |
| 권한 | 의사·간호사 |
| 화면 | S8 기준 정보: 약품 |
| 순위 | 3 |

**추가 `POST` → `201 Created`**

| 필드 | 타입 | 필수 | 규칙 |
| --- | --- | --- | --- |
| `drugCode` | string | O | 1~10자. 예: D201 |
| `name` | string | O | 1~100자 |
| `ingredient` | string \| null | | 100자 이내 |
| `form` | string | O | 1~20자. 예: 정제, 주사제 |
| `unit` | string | O | 1~20자. 예: 정, 바이알 |
| `unitPrice` | number | O | 0 이상 정수(원) |

```json
{ "drugCode": "D202", "name": "타이레놀정 650mg", "ingredient": "아세트아미노펜", "form": "정제", "unit": "정", "unitPrice": 150 }
```

**수정 `PATCH` → `200 OK`**: 약품코드 말고 나머지 중 고친 것만 보냅니다.

**삭제 `DELETE` → `204 No Content`**

응답 본문은 4-6의 항목 하나와 같은 모양입니다.

**오류**: 400, 401, 403, 404, 409 `CODE_TAKEN`, 409 `IN_USE`(처방상세에 쓰인 약품 삭제)

**규칙**

- 약품코드는 만든 뒤 잠급니다.
- 단가를 바꾸면 그 뒤에 만드는 청구부터 적용됩니다. 이미 만든 청구비용은 그대로입니다. 화면은 단가 칸 아래에 이 점을 적어 둡니다.

---

## 4-10. 검사항목 추가·수정·삭제

| 항목 | 내용 |
| --- | --- |
| 요청 | `POST /api/exam-items`, `PATCH /api/exam-items/{examCode}`, `DELETE /api/exam-items/{examCode}` |
| 권한 | 의사·간호사 |
| 화면 | S8a 기준 정보: 검사항목 |
| 순위 | 3 |

**추가 `POST` → `201 Created`**

| 필드 | 타입 | 필수 | 규칙 |
| --- | --- | --- | --- |
| `examCode` | string | O | 1~10자. 예: L101 |
| `name` | string | O | 1~100자 |
| `category` | `'혈액' \| '영상' \| '기능'` | O | |
| `referenceRange` | string \| null | | 50자 이내. 영상·기능이면 null이어야 함 |
| `unit` | string \| null | | 20자 이내. 영상·기능이면 null이어야 함 |
| `fee` | number | O | 0 이상 정수(원) |

```json
{ "examCode": "F302", "name": "폐기능 검사", "category": "기능", "referenceRange": null, "unit": null, "fee": 18000 }
```

**수정 `PATCH` → `200 OK`**: 검사코드 말고 나머지 중 고친 것만 보냅니다. 분류를 영상·기능으로 바꾸면 참고치·단위도 `null`로 함께 보내야 합니다.

**삭제 `DELETE` → `204 No Content`**

응답 본문은 4-7의 항목 하나와 같은 모양입니다.

**오류**: 400, 401, 403, 404, 409 `CODE_TAKEN`, 409 `IN_USE`(검사에 쓰인 항목 삭제)

**규칙**

- 영상·기능 검사는 참고치와 단위가 NULL인 것이 정상입니다. 화면은 분류에 따라 두 칸을 접습니다.
- 검사비를 바꾸면 그 뒤에 만드는 청구부터 적용됩니다.
