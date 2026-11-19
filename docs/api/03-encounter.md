# 03 진료 관리

- **담당**: 박지수
- **시스템 구성도 03 영역**: 진료 기록 작성(외래·회진), 진단 등록, 진료 내역 조회. 처방 등록과 검사 요청도 진료와 함께 저장합니다.
- **관련 테이블**: encounter(진료), diagnosis(진단), prescription(처방전), prescription_item(처방상세), exam(검사, 요청 단계)
- 공통 규칙은 [README](README.md)를 따릅니다. 검사의 시행·판독과 질병·약품·검사항목은 [04-order.md](04-order.md)에 있습니다.

| 번호 | 요청 | 권한 | 화면 | 순위 |
| --- | --- | --- | --- | --- |
| [3-1](#3-1-진료-기록-저장) | `POST /api/encounters` | 의사 | S2, S2a, S2b | 1 (회진은 2) |
| [3-2](#3-2-내-진료-기록) | `GET /api/me/encounters` | 환자 | P4, P1a | 1 |
| [3-3](#3-3-진료-기록-한-건) | `GET /api/encounters/{encounterId}` | 의사·간호사 | S2, S3b, S9 | 3 |
| [3-4](#3-4-진료-기록-수정) | `PATCH /api/encounters/{encounterId}` | 의사 (작성자) | S2 | 3 |

---

## 진료 상세 객체

3-2, 3-3이 돌려주는 진료 한 건입니다. 진단·처방·검사를 진료 안에 묶어 "그날 무슨 일이 있었나"로 읽히게 합니다.

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `encounterId` | number | 진료번호 |
| `encounterType` | `'외래' \| '입원'` | 진료구분. '입원'은 회진 |
| `encounterAt` | datetime | 진료일시 |
| `patient` | object | [환자 요약](README.md#공통-객체) |
| `doctorId`, `doctorName` | number, string | 진료한 의사 |
| `departmentCode`, `departmentName` | string, string | 진료한 의사의 진료과 |
| `reservationId` | number \| null | 외래만 |
| `admissionId` | number \| null | 회진만 (진료.입원번호) |
| `symptom` | string \| null | 증상 |
| `finding` | string | 소견 |
| `diagnoses` | array | 진단. 주진단이 맨 앞 |
| `diagnoses[].diseaseCode`, `diseaseName` | string, string | 질병코드, 질병명 |
| `diagnoses[].isPrimary` | boolean | 주진단 여부 |
| `prescriptions` | array | 처방전 |
| `prescriptions[].prescriptionId` | number | 처방번호 |
| `prescriptions[].dispenseType` | `'원내' \| '원외'` | 처방구분 |
| `prescriptions[].prescribedAt` | datetime | 처방일시 |
| `prescriptions[].items` | array | 처방상세: `drugCode`, `drugName`, `unit`(약품.단위), `dose`, `timesPerDay`, `durationDays`, `instruction` |
| `exams` | array | 이 진료에서 요청한 검사: `examId`, `examCode`, `examName`, `category`, `status`, `requestedAt` |
| `admissionDecided` | boolean | 외래 진료에서 입원을 결정했는지. 회진이면 false |
| `editable` | boolean | 로그인한 의사가 작성자인지. 3-3에서만 의미가 있고 3-2는 항상 false |

```json
{
  "encounterId": 5530,
  "encounterType": "외래",
  "encounterAt": "2026-11-11T10:14:00",
  "patient": { "patientId": 10234, "name": "김서연", "birthDate": "1994-03-12", "gender": "여" },
  "doctorId": 12,
  "doctorName": "박지훈",
  "departmentCode": "IM",
  "departmentName": "내과",
  "reservationId": 1201,
  "admissionId": null,
  "symptom": "식후 속쓰림, 야간 악화",
  "finding": "위 점막 자극 소견. 2주 복약 후 경과 관찰.",
  "diagnoses": [
    { "diseaseCode": "K29.7", "diseaseName": "위염", "isPrimary": true },
    { "diseaseCode": "K21.0", "diseaseName": "역류성 식도염", "isPrimary": false }
  ],
  "prescriptions": [
    {
      "prescriptionId": 7001,
      "dispenseType": "원외",
      "prescribedAt": "2026-11-11T10:14:00",
      "items": [
        { "drugCode": "D305", "drugName": "에소메프라졸정 20mg", "unit": "정", "dose": 1, "timesPerDay": 1, "durationDays": 14, "instruction": "아침 식전" }
      ]
    }
  ],
  "exams": [
    { "examId": 3301, "examCode": "L101", "examName": "일반혈액검사", "category": "혈액", "status": "요청", "requestedAt": "2026-11-11T10:14:00" }
  ],
  "admissionDecided": false,
  "editable": true
}
```

---

## 3-1. 진료 기록 저장

| 항목 | 내용 |
| --- | --- |
| 요청 | `POST /api/encounters` |
| 권한 | 의사 |
| 화면 | S2 진료 기록 작성, S2a 진단·처방·검사 추가(외래), S2b 회진 기록 |
| 순위 | 1 (회진은 2) |

진료 한 번의 기록을 진단·처방·검사 요청과 함께 **한 번에** 저장합니다. 외래는 예약번호, 회진은 입원번호를 넣고, 둘 중 정확히 하나만 넣습니다. 프론트엔드는 S1에서 들어오면 외래, S5에서 들어오면 회진으로 정하고 사용자에게 묻지 않습니다.

**요청 본문**

| 필드 | 타입 | 필수 | 규칙 |
| --- | --- | --- | --- |
| `reservationId` | number \| null | 외래 O | 상태가 '예약'인 예약 |
| `admissionId` | number \| null | 회진 O | 퇴원 전인 입원 |
| `encounterAt` | datetime \| null | | 회진만. 입원일시 이후, 지금 이전. 비우면 지금. 외래는 넣지 않음(저장한 시각) |
| `symptom` | string \| null | | 2,000자 이내. 비워도 됨 |
| `finding` | string | O | 1~2,000자. 화면의 "특이 소견 없음" 칩은 이 문구를 그대로 넣음 |
| `diagnoses` | array | 외래 O | 외래는 1건 이상이고 주진단이 정확히 1건. 회진은 빈 배열(넣으면 같은 규칙) |
| `diagnoses[].diseaseCode` | string | O | 등록된 질병코드. 같은 진료에 중복 불가 |
| `diagnoses[].isPrimary` | boolean | O | |
| `prescriptions` | array | | 처방구분마다 1건까지. 회진은 '원내'만 |
| `prescriptions[].dispenseType` | `'원내' \| '원외'` | O | |
| `prescriptions[].items` | array | O | 1건 이상 |
| `items[].drugCode` | string | O | 등록된 약품코드. 같은 처방전에 중복 불가 |
| `items[].dose` | number | O | 0보다 크고 9999.99 이하, 소수 둘째 자리까지. 단위는 약품.단위 |
| `items[].timesPerDay` | number | O | 1 이상 정수 |
| `items[].durationDays` | number | O | 1 이상 정수 |
| `items[].instruction` | string | O | 1~100자. 예: 식후 30분 |
| `exams` | array | | 요청할 검사 |
| `exams[].examCode` | string | O | 등록된 검사코드. 같은 진료에 중복 불가 |
| `admissionDecided` | boolean | | 외래만. 기본 false. true면 결제를 만들지 않고 입원 배정 대기로 넘김 |

외래 예:

```json
{
  "reservationId": 1201,
  "admissionId": null,
  "encounterAt": null,
  "symptom": "식후 속쓰림, 야간 악화",
  "finding": "위 점막 자극 소견. 2주 복약 후 경과 관찰.",
  "diagnoses": [
    { "diseaseCode": "K29.7", "isPrimary": true },
    { "diseaseCode": "K21.0", "isPrimary": false }
  ],
  "prescriptions": [
    {
      "dispenseType": "원외",
      "items": [
        { "drugCode": "D305", "dose": 1, "timesPerDay": 1, "durationDays": 14, "instruction": "아침 식전" }
      ]
    }
  ],
  "exams": [ { "examCode": "L101" } ],
  "admissionDecided": false
}
```

회진 예:

```json
{
  "reservationId": null,
  "admissionId": 731,
  "encounterAt": "2026-11-11T08:40:00",
  "symptom": "수술 부위 통증 감소",
  "finding": "발열 없음. 상처 양호. 식이 진행.",
  "diagnoses": [],
  "prescriptions": [
    {
      "dispenseType": "원내",
      "items": [
        { "drugCode": "D550", "dose": 1, "timesPerDay": 2, "durationDays": 3, "instruction": "정맥 주사" }
      ]
    }
  ],
  "exams": [ { "examCode": "L101" } ],
  "admissionDecided": false
}
```

**응답 `201 Created`**

```json
{
  "encounterId": 5530,
  "encounterType": "외래",
  "encounterAt": "2026-11-11T10:14:00",
  "reservationId": 1201,
  "admissionId": null,
  "admissionDecided": false,
  "paymentId": 9101
}
```

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `paymentId` | number \| null | 함께 만든 '미결제' 결제의 번호. 회진이거나 입원을 결정했으면 null |

**오류**

| 상태 | code | 언제 |
| --- | --- | --- |
| 400 | `VALIDATION_FAILED` | 소견이 없음, 예약번호·입원번호가 둘 다 있거나 둘 다 없음, 외래에 `encounterAt`·회진에 `admissionDecided`, 주진단이 1건이 아님, 코드 중복·없는 코드, 빈 처방전, 수량이 범위를 벗어남, 회진의 원외 처방, 회진 일시가 입원 기간 밖. S2는 `fields`의 칸 이름으로 문제 있는 섹션에만 표시 |
| 401 | `UNAUTHENTICATED` | |
| 403 | `FORBIDDEN` | 의사가 아님 |
| 404 | `NOT_FOUND` | 없는 예약번호·입원번호 |
| 409 | `INVALID_STATUS` | 예약이 '예약' 상태가 아님(이미 진료함, 취소, 노쇼), 입원이 이미 퇴원함 |
| 409 | `ALREADY_ADMITTED` | 입원을 결정했는데 환자가 이미 입원 중. `details`에 `{ "admissionId": 731, "roomNo": 502 }` |

**규칙**

- CHECK (예약번호 IS NULL) <> (입원번호 IS NULL), CHECK (진료구분 = '외래') = (예약번호 IS NOT NULL)
- UNIQUE 예약번호: 예약 1건에 진료는 최대 1건입니다.
- 의사번호는 로그인한 의사이고, 직종이 '의사'여야 합니다.
- 진료의 환자는 연결된 예약·입원의 환자와 같아야 하고, 회진 일시는 입원 기간 안이어야 합니다.
- 진료마다 주진단('Y') 1건을 등록 트랜잭션 안에서 확인합니다.
- 처방전 1건에는 처방상세가 1건 이상 있어야 하고, 1회투여량·1일투여횟수·투약일수는 0보다 커야 합니다.
- 검사는 상태 '요청', 요청일시는 저장한 시각으로 만듭니다.
- 외래를 저장하면 예약이 '완료'가 되고, 입원 결정이 아니면 '미결제' 결제가 함께 만들어집니다. 셋 중 하나라도 실패하면 아무것도 저장하지 않습니다.
- 입원을 결정한 진료는 결제를 만들지 않습니다. 이 진료는 [5-2 배정 대기](05-admission.md#5-2-입원-배정-대기)에 나타나고, 결제는 퇴원 처리 때 만들어집니다.
- 회진에는 결제를 만들지 않습니다. 회진에서 요청한 검사와 원내 처방은 퇴원 때 입원 청구에 합산됩니다.

**백엔드 메모**

외래와 회진 모두 `@Transactional` 하나로 처리합니다. 다른 담당자의 기능을 부르는 곳은 [연결 지점](README.md#6-백엔드-연결-지점)에 있습니다.

1. 로그인한 의료진이 의사인지 확인 (배성진님의 로그인 사용자 확인 기능)
2. 외래: 예약을 조회해 상태가 '예약'인지 확인 (배성진). 회진: 입원을 조회해 퇴원 전인지, 진료일시가 입원 기간 안인지 확인 (김지원)
3. 외래이고 입원 결정이면 환자가 이미 입원 중인지 확인 (김지원)
4. 진료 INSERT. 환자번호는 예약·입원(결정 진료)의 환자, 의사번호는 로그인한 의사
5. 진단, 처방전·처방상세, 검사 INSERT
6. 외래: 예약을 '완료'로 (배성진)
7. 외래이고 입원 결정이 아니면 청구 생성 (김지원) → `paymentId`

## 다른 담당자가 쓰는 기능

HTTP API가 아니라 백엔드 안에서 부르는 기능입니다. 업무분담서 완료 기준의 "청구 담당자가 진료번호별 요청 검사와 원내 처방상세를 조회"에 해당합니다.

| 기능 | 부르는 쪽 | 돌려주는 것 |
| --- | --- | --- |
| 진료번호별 청구 근거 조회 | 김지원 (외래 청구, 퇴원 청구, 결제 취소 후 다시 청구) | 요청 검사 목록(검사코드, 검사항목.검사비), 원내 처방상세 목록(약품코드, 약품.단가, 1회투여량, 1일투여횟수, 투약일수), 원외 처방 여부 |
| 입원번호별 회진 진료 목록 | 김지원 (퇴원 청구, 5-5) | 회진 진료번호, 진료일시, 의사, 소견 |
| 배정 대기 진료 조회 | 김지원 (5-2) | 결제도 입원도 없는 외래 진료 |

---

## 3-2. 내 진료 기록

| 항목 | 내용 |
| --- | --- |
| 요청 | `GET /api/me/encounters` |
| 권한 | 환자 |
| 화면 | P4 진료 기록, P1a 입원 내역의 회진 목록 |
| 순위 | 1 |

로그인한 환자의 진료를 외래와 회진 모두 돌려줍니다. P4는 회진을 "입원 회진"으로 표시하고, P1a는 `admissionId`로 그 입원의 회진만 골라 씁니다.

**응답 `200 OK`**: [진료 상세 객체](#진료-상세-객체)의 배열, 진료일시 내림차순

- `exams`에는 상태가 '완료'인 검사만 들어 있습니다(P4의 "결과 보기"는 P5로 이동).
- `editable`은 항상 false입니다.

**오류**: 401, 403(의료진이 호출)

**규칙**

- 환자는 본인 데이터만 조회합니다.
- 환자에게는 '완료' 검사만 보여 줍니다.

---

## 3-3. 진료 기록 한 건

| 항목 | 내용 |
| --- | --- |
| 요청 | `GET /api/encounters/{encounterId}` |
| 권한 | 의사·간호사 |
| 화면 | S9 읽기 전용 진료 기록, S3b 기록 보기, S2 수정할 때 불러오기 |
| 순위 | 3 |

**응답 `200 OK`**: [진료 상세 객체](#진료-상세-객체). 검사는 모든 상태가 들어 있습니다.

`editable`이 false면 화면을 읽기 전용으로 열고, 저장 버튼 대신 "박지훈 의사가 10:14에 작성했습니다"처럼 작성자와 시각을 보여 줍니다.

**오류**: 401, 403(환자·원무가 호출), 404 `NOT_FOUND`

---

## 3-4. 진료 기록 수정

| 항목 | 내용 |
| --- | --- |
| 요청 | `PATCH /api/encounters/{encounterId}` |
| 권한 | 의사 (그 진료를 작성한 의사) |
| 화면 | S2 진료 기록 작성 (수정) |
| 순위 | 3 |

증상, 소견, 진단을 고칩니다. 처방과 검사는 고칠 수 없습니다. 저장할 때 이미 청구 금액이 계산됐기 때문입니다. 추가 처방·검사는 다음 진료나 회진에서 합니다.

**요청 본문**: 고친 필드만 보냅니다.

| 필드 | 타입 | 규칙 |
| --- | --- | --- |
| `symptom` | string \| null | 3-1과 같음 |
| `finding` | string | 3-1과 같음. 비울 수 없음 |
| `diagnoses` | array | 보내면 진단 전체를 이 목록으로 바꿈. 규칙은 3-1과 같음 |

```json
{
  "finding": "위 점막 자극 소견. 4주 복약 후 경과 관찰.",
  "diagnoses": [ { "diseaseCode": "K29.7", "isPrimary": true } ]
}
```

**응답 `200 OK`**: 고친 뒤의 [진료 상세 객체](#진료-상세-객체)

**오류**

| 상태 | code | 언제 |
| --- | --- | --- |
| 400 | `VALIDATION_FAILED` | 3-1과 같은 규칙 위반, 처방·검사를 고치려 함 |
| 401 | `UNAUTHENTICATED` | |
| 403 | `FORBIDDEN` | 작성한 의사가 아님. 주치의라도 다른 의사의 기록은 고칠 수 없음 |
| 404 | `NOT_FOUND` | 없는 진료번호 |

**규칙**

- 진료 기록은 작성한 의사만 수정합니다.
- 진단을 바꿔도 주진단은 1건이어야 합니다.
