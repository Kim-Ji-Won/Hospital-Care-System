# 01 회원 관리

- **담당**: 배성진
- **시스템 구성도 01 영역**: 환자 등록·회원가입, 로그인·권한 확인, 환자 정보 관리, 직원(의료진·원무) 정보 관리, 진료과 관리
- **관련 테이블**: patient(환자), staff(의료진), department(진료과)
- 공통 규칙(주소, 값 표기, 권한, 오류 형식)은 [README](README.md)를 따릅니다.

| 번호 | 요청 | 권한 | 화면 | 순위 |
| --- | --- | --- | --- | --- |
| [1-1](#1-1-로그인) | `POST /api/auth/login` | 없음 | P0 | 1 |
| [1-2](#1-2-로그아웃) | `POST /api/auth/logout` | 없음 | 공통 | 1 |
| [1-3](#1-3-로그인-상태-확인) | `GET /api/auth/me` | 로그인 | 공통 | 1 |
| [1-4](#1-4-회원가입-환자-등록) | `POST /api/auth/signup` | 없음 | P0a | 1 |
| [1-5](#1-5-내-정보) | `GET /api/me/profile` | 환자 | P1 | 1 |
| [1-6](#1-6-환자-정보-의료진용) | `GET /api/patients/{patientId}` | 의사·간호사·원무 | S1, S2, S3, S6 | 1 |
| [1-7](#1-7-진료과-목록) | `GET /api/departments` | 로그인 | P2, S8a, S8b | 1 |
| [1-8](#1-8-의료진-목록) | `GET /api/staff` | 의사·간호사 | S5a, S7, S8b | 2 |
| [1-9](#1-9-환자-검색) | `GET /api/patients` | 의사·간호사·원무 | S3 | 3 |
| [1-10](#1-10-환자-정보-수정) | `PATCH /api/patients/{patientId}` | 의사·간호사·원무 | S3a | 3 |
| [1-11](#1-11-환자-이력) | `GET /api/patients/{patientId}/history` | 의사·간호사·원무 | S3b | 3 |
| [1-12](#1-12-의료진-등록) | `POST /api/staff` | 의사·간호사 | S8b | 3 |
| [1-13](#1-13-의료진-정보-수정) | `PATCH /api/staff/{staffId}` | 의사·간호사 | S8b | 3 |
| [1-14](#1-14-진료과-추가수정삭제) | `POST /api/departments`, `PATCH·DELETE /api/departments/{departmentCode}` | 의사·간호사 | S8a | 3 |

---

## 로그인 사용자 객체

로그인(1-1), 로그인 상태 확인(1-3), 회원가입(1-4)이 돌려주는 객체입니다. 프론트엔드는 `role`로 레이아웃(환자는 상단 메뉴, 의료진은 사이드바)과 보여 줄 메뉴를 정합니다.

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `role` | `'환자' \| '의사' \| '간호사' \| '원무'` | 환자면 '환자', 의료진이면 직종과 같음 |
| `patientId` | number \| null | 환자번호. 환자만 |
| `staffId` | number \| null | 의료진번호. 의료진만 |
| `loginId` | string | 로그인ID |
| `name` | string | 이름 |
| `position` | string \| null | 직급. 의료진만, 없으면 null |
| `departmentCode` | string \| null | 진료과코드. 의사·간호사만 |
| `departmentName` | string \| null | 진료과명. 의사·간호사만 |

환자:

```json
{
  "role": "환자",
  "patientId": 10234,
  "staffId": null,
  "loginId": "seoyeon01",
  "name": "김서연",
  "position": null,
  "departmentCode": null,
  "departmentName": null
}
```

의사:

```json
{
  "role": "의사",
  "patientId": null,
  "staffId": 12,
  "loginId": "jhpark",
  "name": "박지훈",
  "position": "전문의",
  "departmentCode": "IM",
  "departmentName": "내과"
}
```

원무 (진료과가 없음):

```json
{
  "role": "원무",
  "patientId": null,
  "staffId": 30,
  "loginId": "smlee",
  "name": "이수민",
  "position": null,
  "departmentCode": null,
  "departmentName": null
}
```

## 의료진 객체

의료진 목록(1-8), 등록(1-12), 수정(1-13)이 돌려주는 객체입니다. 비밀번호해시는 내보내지 않습니다.

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `staffId` | number | 의료진번호 |
| `name` | string | 이름 |
| `jobType` | `'의사' \| '간호사' \| '원무'` | 직종 |
| `position` | string \| null | 직급 |
| `departmentCode` | string \| null | 진료과코드. 원무는 null |
| `departmentName` | string \| null | 진료과명. 원무는 null |
| `phone` | string | 연락처 |
| `loginId` | string | 로그인ID |

```json
{
  "staffId": 12,
  "name": "박지훈",
  "jobType": "의사",
  "position": "전문의",
  "departmentCode": "IM",
  "departmentName": "내과",
  "phone": "010-5550-0112",
  "loginId": "jhpark"
}
```

## 다른 담당자가 쓰는 기능

HTTP API가 아니라 백엔드 안에서 부르는 기능입니다. 업무분담서의 "다른 담당자가 로그인한 사용자의 번호와 직종을 확인할 수 있게 합니다"에 해당합니다.

| 기능 | 부르는 쪽 | 하는 일 |
| --- | --- | --- |
| 로그인 사용자 확인 | 모든 담당자 | 세션에서 계정 종류, 번호(`patientId` 또는 `staffId`), `role`, 진료과코드를 꺼내 줌. 로그인하지 않았으면 `UNAUTHENTICATED` |
| 직종 확인 | 박지수 (의사 전용 작성), 김지원 (원무 전용 수납) | 허용한 `role`이 아니면 `FORBIDDEN`을 던짐. 예: 수납은 `원무`만, 진료 저장은 `의사`만 |

---

## 1-1. 로그인

| 항목 | 내용 |
| --- | --- |
| 요청 | `POST /api/auth/login` |
| 권한 | 없음 |
| 화면 | P0 로그인·회원가입 |
| 순위 | 1 |

환자와 의료진이 같은 화면에서 역할(환자/의료진)만 바꿔 로그인합니다. 성공하면 세션을 만들고 로그인 사용자 정보를 돌려줍니다.

**요청 본문**

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `accountType` | `'환자' \| '의료진'` | O | 어느 계정 테이블에서 찾을지. 원무 직원은 '의료진' |
| `loginId` | string | O | |
| `password` | string | O | 평문. 서버가 저장된 해시와 비교 |

```json
{
  "accountType": "환자",
  "loginId": "seoyeon01",
  "password": "seoyeon1234"
}
```

**응답 `200 OK`**

[로그인 사용자 객체](#로그인-사용자-객체)를 돌려주고, 응답 헤더에 세션 쿠키를 붙입니다.

```http
Set-Cookie: JSESSIONID=…; Path=/; HttpOnly
```

**오류**

| 상태 | code | 언제 |
| --- | --- | --- |
| 400 | `VALIDATION_FAILED` | `accountType`이 없거나 다른 값, 아이디나 비밀번호가 빈 값 |
| 401 | `LOGIN_FAILED` | 그 아이디의 계정이 없거나 비밀번호가 틀림. 둘 중 무엇인지 구분하지 않음 |

**규칙**

- 로그인ID는 환자 테이블, 의료진 테이블 안에서 각각 UNIQUE입니다. 두 테이블 사이에는 같은 아이디가 있을 수 있어서 `accountType`으로 테이블을 고릅니다.
- 계정이 있는지 드러내지 않습니다. 아이디가 없을 때와 비밀번호가 틀렸을 때 같은 응답을 줍니다. (P0 오류 화면 근거)

**백엔드 메모**

- 환자는 `patient`, 의료진은 `staff`에서 `login_id`로 찾은 뒤 BCrypt로 비밀번호를 비교합니다.
- 로그인에 성공하면 기존 세션이 있으면 끝내고 새 세션을 만듭니다(세션 고정 공격 방지).
- 세션에는 계정 종류, 번호(`patientId` 또는 `staffId`), `role`, 진료과코드를 넣어 두고, 다른 담당자도 쓰는 [로그인 사용자 확인 기능](README.md#6-백엔드-연결-지점)으로 꺼내 줍니다.

---

## 1-2. 로그아웃

| 항목 | 내용 |
| --- | --- |
| 요청 | `POST /api/auth/logout` |
| 권한 | 없음 (로그인 검사에서 빼 주세요) |
| 화면 | 공통 (상단 메뉴·사이드바의 로그아웃) |
| 순위 | 1 |

세션을 끝냅니다. 요청 본문은 없습니다. 세션이 이미 끝났을 때 로그아웃을 눌러도 오류가 나지 않도록 로그인 검사 대상에서 뺍니다.

**응답 `204 No Content`**

**오류**: 없습니다. 세션이 이미 없어도 `204`를 돌려줍니다.

---

## 1-3. 로그인 상태 확인

| 항목 | 내용 |
| --- | --- |
| 요청 | `GET /api/auth/me` |
| 권한 | 로그인 |
| 화면 | 공통 (새로고침하거나 주소로 바로 들어왔을 때), S9 세션 만료 |
| 순위 | 1 |

지금 로그인한 사용자를 돌려줍니다. 프론트엔드는 앱을 열 때 이 값으로 로그인 여부와 레이아웃을 정합니다.

**응답 `200 OK`**: [로그인 사용자 객체](#로그인-사용자-객체) (1-1과 같음)

**오류**

| 상태 | code | 언제 |
| --- | --- | --- |
| 401 | `UNAUTHENTICATED` | 세션이 없거나 끝남. 프론트엔드는 로그인 화면으로 보냄 |

**백엔드 메모**

- 세션에 넣어 둔 번호로 DB를 다시 읽어 이름·직급·진료과 같은 최신 값을 돌려줍니다. 정보를 고친 뒤에도 화면에 맞게 보이도록 하기 위해서입니다.

---

## 1-4. 회원가입 (환자 등록)

| 항목 | 내용 |
| --- | --- |
| 요청 | `POST /api/auth/signup` |
| 권한 | 없음 |
| 화면 | P0a 회원가입 |
| 순위 | 1 |

처음 오는 환자가 환자 등록과 로그인 계정 만들기를 한 번에 합니다. 환자 행이 생기는 유일한 경로입니다(창구 등록 없음). 가입이 끝나면 바로 로그인된 상태가 되고, 프론트엔드는 예약 화면(P2)으로 이동합니다.

**요청 본문**

| 필드 | 타입 | 필수 | 규칙 | 저장 컬럼 |
| --- | --- | --- | --- | --- |
| `name` | string | O | 1~50자 | 환자.이름 |
| `birthDate` | date | O | 1900-01-01부터 오늘 이전까지 | 환자.생년월일 |
| `gender` | `'남' \| '여'` | O | | 환자.성별 |
| `phone` | string | O | 숫자와 하이픈만, 20자 이내. 프론트엔드가 `010-0000-0000` 형식으로 맞춰 보냄 | 환자.연락처 |
| `loginId` | string | O | 영문·숫자 4~20자 | 환자.로그인ID |
| `password` | string | O | 8~64자, 영문과 숫자를 모두 포함 | BCrypt 해시를 환자.비밀번호해시에 |

주소와 혈액형은 받지 않고 NULL로 저장합니다. 필요하면 의료진이 환자 정보 수정(S3a, 1-10)에서 채웁니다.

```json
{
  "name": "한지우",
  "birthDate": "1999-02-14",
  "gender": "남",
  "phone": "010-5550-0163",
  "loginId": "jiwoo99",
  "password": "jiwoo2026"
}
```

**응답 `201 Created`**

[로그인 사용자 객체](#로그인-사용자-객체)를 돌려주고, 세션 쿠키도 함께 붙여 바로 로그인 상태로 만듭니다. 프론트엔드는 가입 완료 안내에 새 환자번호(`patientId`)를 보여 줍니다.

```json
{
  "role": "환자",
  "patientId": 10901,
  "staffId": null,
  "loginId": "jiwoo99",
  "name": "한지우",
  "position": null,
  "departmentCode": null,
  "departmentName": null
}
```

**오류**

| 상태 | code | 언제 |
| --- | --- | --- |
| 400 | `VALIDATION_FAILED` | 칸별 규칙 위반. `fields`에 칸 이름과 이유 |
| 409 | `ALREADY_REGISTERED` | 이름·생년월일·연락처가 모두 같은 환자가 이미 있음. 프론트엔드는 로그인으로 안내 |
| 409 | `LOGIN_ID_TAKEN` | 다른 환자가 이미 쓰는 아이디. 프론트엔드는 아이디 칸 아래에 표시 |

두 오류에 모두 해당하면 `ALREADY_REGISTERED`를 돌려줍니다.

**규칙**

- 환자 등록은 웹 회원가입으로만 합니다(11. 18 결정).
- 환자번호는 AUTO_INCREMENT로 자동 부여합니다.
- 환자 테이블에는 사람을 구분하는 UNIQUE가 없습니다. 같은 사람이 두 번 가입하지 않도록 이름·생년월일·연락처가 모두 같을 때만 막습니다. 세 값이 모두 맞을 때만 알려 주므로 남의 가입 여부를 떠보기 어렵습니다.
- 로그인ID는 환자 테이블 안에서 UNIQUE입니다(DB 제약).
- 로그인ID·비밀번호해시 컬럼은 NULL을 허용하지만, 가입에서는 필수로 받습니다.

**백엔드 메모**

- 처리 순서: 입력 검사 → 같은 사람 검사(이름·생년월일·연락처가 모두 같은 행) → 아이디 중복 검사 → INSERT → 세션 생성
- 같은 아이디로 동시에 가입해 INSERT에서 UNIQUE 위반이 나면 `LOGIN_ID_TAKEN`으로 바꿔 돌려줍니다.
- 의료진 아이디와 겹치는지는 검사하지 않습니다. 테이블이 다르고, 로그인할 때 `accountType`으로 구분합니다.

---

## 1-5. 내 정보

| 항목 | 내용 |
| --- | --- |
| 요청 | `GET /api/me/profile` |
| 권한 | 환자 |
| 화면 | P1 홈 (내 정보 카드) |
| 순위 | 1 |

로그인한 환자 본인의 기본 정보입니다.

**응답 `200 OK`**

```json
{
  "patientId": 10234,
  "name": "김서연",
  "birthDate": "1994-03-12",
  "gender": "여",
  "phone": "010-5550-4821",
  "address": "서울 성북구 보문로",
  "bloodType": "A형 (Rh+)",
  "loginId": "seoyeon01"
}
```

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `patientId` | number | 환자번호 |
| `name` | string | 이름 |
| `birthDate` | date | 생년월일 |
| `gender` | `'남' \| '여'` | 성별 |
| `phone` | string | 연락처 전체. 가려서 보여 주는 일은 프론트엔드가 함 |
| `address` | string \| null | 주소 |
| `bloodType` | string \| null | 혈액형. 예: "A형 (Rh+)" |
| `loginId` | string | 로그인ID |

**오류**

| 상태 | code | 언제 |
| --- | --- | --- |
| 401 | `UNAUTHENTICATED` | 로그인하지 않음 |
| 403 | `FORBIDDEN` | 의료진 계정이 호출 |

**규칙**

- 환자는 본인 데이터만 조회합니다. 세션의 환자번호로만 조회합니다.
- 환자가 직접 고치는 기능은 없습니다. 수정은 의료진 화면(S3a, 1-10)에서 합니다.
- 비밀번호해시는 어떤 API에서도 내보내지 않습니다.

---

## 1-6. 환자 정보 (의료진용)

| 항목 | 내용 |
| --- | --- |
| 요청 | `GET /api/patients/{patientId}` |
| 권한 | 의사·간호사·원무 |
| 화면 | S1 오른쪽 환자 요약, S2 머리 요약, S3 오른쪽 요약, S6 환자번호 조회 |
| 순위 | 1 |

환자 한 명의 기본 정보와, 화면 요약에 쓰는 최근 진료·다음 예약·입원 중 여부를 함께 돌려줍니다. 원무 직원의 수납 화면(S6)도 환자번호를 입력하면 이 API로 환자를 찾습니다.

**경로 변수**

| 이름 | 타입 | 설명 |
| --- | --- | --- |
| `patientId` | number | 환자번호 |

**응답 `200 OK`**

```json
{
  "patientId": 10234,
  "name": "김서연",
  "birthDate": "1994-03-12",
  "gender": "여",
  "phone": "010-5550-4821",
  "address": "서울 성북구 보문로",
  "bloodType": "A형 (Rh+)",
  "loginId": "seoyeon01",
  "lastEncounter": {
    "encounterId": 5521,
    "encounterAt": "2026-10-28T09:35:00",
    "encounterType": "외래",
    "departmentName": "내과",
    "primaryDiseaseName": "위염"
  },
  "nextReservation": {
    "reservationId": 1201,
    "appointmentAt": "2026-11-11T10:00:00",
    "departmentName": "내과",
    "doctorName": "박지훈"
  },
  "currentAdmission": null
}
```

입원 중인 환자라면 `currentAdmission`이 채워집니다.

```json
"currentAdmission": {
  "admissionId": 731,
  "roomNo": 502,
  "ward": "5층",
  "admittedAt": "2026-11-05T10:20:00"
}
```

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `patientId` ~ `loginId` | | [1-5 내 정보](#1-5-내-정보)와 같음 |
| `lastEncounter` | object \| null | 가장 최근 진료 1건. 진료가 없으면 null |
| `lastEncounter.encounterId` | number | 진료번호 |
| `lastEncounter.encounterAt` | datetime | 진료일시 |
| `lastEncounter.encounterType` | `'외래' \| '입원'` | 진료구분 |
| `lastEncounter.departmentName` | string | 진료한 의사의 진료과명 |
| `lastEncounter.primaryDiseaseName` | string \| null | 주진단의 질병명. 진단이 없으면 null |
| `nextReservation` | object \| null | 지금 이후 가장 가까운 '예약' 상태 예약. 없으면 null |
| `nextReservation.reservationId` | number | 예약번호 |
| `nextReservation.appointmentAt` | datetime | 예약일시 |
| `nextReservation.departmentName` | string | 진료과명 |
| `nextReservation.doctorName` | string | 배정된 의사 이름 |
| `currentAdmission` | object \| null | 지금 입원 중이면 그 입원, 아니면 null |
| `currentAdmission.admissionId` | number | 입원번호 |
| `currentAdmission.roomNo` | number | 병실번호 |
| `currentAdmission.ward` | string | 병동. 예: "5층" |
| `currentAdmission.admittedAt` | datetime | 입원일시 |

**오류**

| 상태 | code | 언제 |
| --- | --- | --- |
| 401 | `UNAUTHENTICATED` | 로그인하지 않음 |
| 403 | `FORBIDDEN` | 환자 계정이 호출 |
| 404 | `NOT_FOUND` | 없는 환자번호. S6은 입력값을 그대로 두고 오류를 보여 줌 |

**규칙**

- 입원 테이블에는 환자번호가 없습니다. 입원.결정진료번호 → 진료.환자번호로 찾습니다.
- 입원 중 = 퇴원일시가 NULL인 입원입니다. S3의 '입원 중' 칩과, S2에서 입원 결정 버튼을 끄는 데(퇴원 전 재입원 불가) 씁니다.

**백엔드 메모**

- `lastEncounter`: 환자번호로 진료를 진료일시 내림차순으로 1건 가져오고, 주진단(`is_primary = 'Y'`)을 질병과 조인해 이름을 붙입니다. 진료·진단·질병은 박지수님 테이블입니다.
- `nextReservation`: 예약 → 진료일정 → 의료진·진료과로 조인합니다.
- `currentAdmission`: 입원을 결정진료번호로 진료와 조인해 환자번호로 거르고, 퇴원일시가 NULL인 행을 병실과 조인해 병동을 붙입니다. 입원·병실은 김지원님 테이블입니다.

---

## 1-7. 진료과 목록

| 항목 | 내용 |
| --- | --- |
| 요청 | `GET /api/departments` |
| 권한 | 로그인 |
| 화면 | P2 진료과 칩, S8a 진료과 표, S8b 진료과 선택 |
| 순위 | 1 |

모든 진료과를 진료과명 가나다순으로 돌려줍니다.

**응답 `200 OK`**

```json
[
  { "departmentCode": "IM", "name": "내과", "location": "본관 2층", "phone": "02-555-0121", "staffCount": 6 },
  { "departmentCode": "PD", "name": "소아청소년과", "location": "별관 1층", "phone": null, "staffCount": 0 },
  { "departmentCode": "GS", "name": "외과", "location": "본관 3층", "phone": "02-555-0131", "staffCount": 4 },
  { "departmentCode": "OS", "name": "정형외과", "location": "본관 3층", "phone": "02-555-0133", "staffCount": 3 }
]
```

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `departmentCode` | string | 진료과코드 |
| `name` | string | 진료과명 |
| `location` | string \| null | 위치. P1의 다음 예약 카드에도 씀 |
| `phone` | string \| null | 전화번호 |
| `staffCount` | number | 이 진료과에 속한 의료진 수. 테이블에 없는 값으로, S8a에서 삭제할 수 있는지 미리 보여 주는 데 씀 |

**오류**: 401 `UNAUTHENTICATED`

---

## 1-8. 의료진 목록

| 항목 | 내용 |
| --- | --- |
| 요청 | `GET /api/staff` |
| 권한 | 의사·간호사 |
| 화면 | S5a 주치의 선택, S7 의사 선택, S8b 의료진 표 |
| 순위 | 2 |

**쿼리**

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `jobType` | `'의사' \| '간호사' \| '원무'` | | 이 직종만. 주치의·진료일정 의사를 고를 때는 `의사` |
| `departmentCode` | string | | 이 진료과만 |

**응답 `200 OK`**: [의료진 객체](#의료진-객체)의 배열. 의료진번호 순입니다.

**오류**

| 상태 | code | 언제 |
| --- | --- | --- |
| 400 | `VALIDATION_FAILED` | `jobType`이 다른 값 |
| 401 | `UNAUTHENTICATED` | 로그인하지 않음 |
| 403 | `FORBIDDEN` | 환자·원무가 호출 |

**규칙**

- 진료일정.의사번호와 입원.주치의번호는 직종이 '의사'인 의료진만 가리킬 수 있습니다. 화면은 `jobType=의사`로 고를 수 있는 사람만 보여 줍니다.

---

## 1-9. 환자 검색

| 항목 | 내용 |
| --- | --- |
| 요청 | `GET /api/patients?q=` |
| 권한 | 의사·간호사·원무 |
| 화면 | S3 환자 |
| 순위 | 3 |

이름, 환자번호, 연락처 뒷자리로 환자를 찾습니다. 결과를 고르면 오른쪽 요약은 1-6으로 불러옵니다.

**쿼리**

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `q` | string | O | 1~50자. 숫자만이면 환자번호가 같거나 연락처가 그 숫자로 끝나는 환자, 그 밖에는 이름에 `q`가 들어간 환자 |

**응답 `200 OK`**: 최대 50명, 이름순

```json
[
  { "patientId": 10234, "name": "김서연", "birthDate": "1994-03-12", "gender": "여", "phone": "010-5550-4821", "admitted": false },
  { "patientId": 9412, "name": "김서현", "birthDate": "1968-11-02", "gender": "여", "phone": "010-5550-7735", "admitted": true }
]
```

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `patientId` ~ `phone` | | 환자 테이블 값 |
| `admitted` | boolean | 지금 입원 중인지. S3의 '입원 중' 칩 |

**오류**

| 상태 | code | 언제 |
| --- | --- | --- |
| 400 | `VALIDATION_FAILED` | `q`가 없거나 50자를 넘음 |
| 401, 403 | | 공통 |

결과가 없으면 빈 배열(`[]`)입니다. S3는 서버 오류와 "찾은 환자가 없음"을 다른 문구로 보여 줍니다.

---

## 1-10. 환자 정보 수정

| 항목 | 내용 |
| --- | --- |
| 요청 | `PATCH /api/patients/{patientId}` |
| 권한 | 의사·간호사·원무 |
| 화면 | S3a 환자 정보 수정 |
| 순위 | 3 |

가입한 환자의 기본 정보를 고칩니다. 새 환자 등록은 하지 않습니다.

**요청 본문**: 고친 필드만 보냅니다.

| 필드 | 타입 | 규칙 |
| --- | --- | --- |
| `name` | string | 1~50자. 비울 수 없음 |
| `birthDate` | date | 1900-01-01부터 오늘 이전까지. 비울 수 없음 |
| `gender` | `'남' \| '여'` | 비울 수 없음 |
| `phone` | string | 숫자와 하이픈만, 20자 이내. 비울 수 없음 |
| `address` | string \| null | 200자 이내. `null`이면 비움 |
| `bloodType` | string \| null | 10자 이내. `null`이면 비움 |

```json
{ "phone": "010-5550-4822", "address": "서울 성북구 보문로 12" }
```

**응답 `200 OK`**: 고친 뒤의 환자 정보 ([1-5 내 정보](#1-5-내-정보)와 같은 모양)

**오류**

| 상태 | code | 언제 |
| --- | --- | --- |
| 400 | `VALIDATION_FAILED` | 필수 칸을 비우거나 규칙 위반. S3a는 그 칸만 표시하고 다른 수정은 유지 |
| 401, 403 | | 공통 |
| 404 | `NOT_FOUND` | 없는 환자번호 |

**규칙**

- 환자번호(PK)와 로그인ID는 고칠 수 없습니다. 보내도 무시하지 않고 `VALIDATION_FAILED`로 돌려줍니다.
- 비밀번호는 의료진 화면에서 다루지 않습니다.
- 이름, 생년월일, 성별, 연락처는 NOT NULL이라 비울 수 없고, 주소와 혈액형은 비울 수 있습니다.

---

## 1-11. 환자 이력

| 항목 | 내용 |
| --- | --- |
| 요청 | `GET /api/patients/{patientId}/history` |
| 권한 | 의사·간호사·원무 |
| 화면 | S3b 환자 이력 |
| 순위 | 3 |

환자 한 명의 예약, 진료, 검사, 입원, 결제를 종류별 배열로 돌려줍니다. 프론트엔드가 하나의 표로 합쳐 시간순으로 정렬하고, 위의 종류별 건수(예약 4 · 진료 3 …)도 배열 길이로 셉니다. 행을 누르면 해당 화면으로 이동하고, 여기서는 아무것도 고치지 않습니다.

**응답 `200 OK`**

```json
{
  "reservations": [
    { "reservationId": 1201, "appointmentAt": "2026-11-11T10:00:00", "status": "예약", "departmentName": "내과", "doctorName": "박지훈", "symptomNote": "식후 속쓰림이 일주일째" }
  ],
  "encounters": [
    { "encounterId": 5521, "encounterAt": "2026-10-28T09:35:00", "encounterType": "외래", "departmentName": "내과", "doctorName": "박지훈", "primaryDiseaseCode": "K29.7", "primaryDiseaseName": "위염" }
  ],
  "exams": [
    { "examId": 3290, "examName": "일반혈액검사", "status": "완료", "requestedAt": "2026-10-28T09:50:00", "performedAt": "2026-10-29T14:20:00", "resultValue": 11.8, "unit": "×10³/µL", "resultFlag": "이상" }
  ],
  "admissions": [
    { "admissionId": 690, "admittedAt": "2026-09-01T11:00:00", "dischargedAt": "2026-09-05T10:30:00", "roomNo": 502, "attendingName": "박지훈" }
  ],
  "payments": [
    { "paymentId": 9077, "encounterId": 5521, "amount": 38500, "status": "미결제", "createdAt": "2026-10-28T10:42:00", "paidAt": null }
  ]
}
```

- 의료진에게는 진행 중인 검사(요청·시행)도 보입니다. 환자 화면(P5)은 '완료'만 보여 줍니다.
- 각 배열은 시각 내림차순입니다. 기준 시각은 예약일시, 진료일시, 요청일시, 입원일시, 생성일시입니다.

**오류**: 401, 403(환자가 호출), 404(없는 환자번호)

**백엔드 메모**

- 환자를 직접 참조하는 테이블은 예약과 진료뿐입니다. 검사·결제는 진료번호로, 입원은 결정진료번호로 진료를 거쳐 찾습니다.

---

## 1-12. 의료진 등록

| 항목 | 내용 |
| --- | --- |
| 요청 | `POST /api/staff` |
| 권한 | 의사·간호사 |
| 화면 | S8b 의료진 계정 |
| 순위 | 3 |

의사, 간호사, 원무 직원을 등록하고 로그인 계정을 만듭니다. 비밀번호는 등록하는 자리에서 새 의료진 본인이 직접 입력합니다.

**요청 본문**

| 필드 | 타입 | 필수 | 규칙 |
| --- | --- | --- | --- |
| `name` | string | O | 1~50자 |
| `phone` | string | O | 숫자와 하이픈만, 20자 이내 |
| `jobType` | `'의사' \| '간호사' \| '원무'` | O | |
| `position` | string \| null | | 20자 이내. 예: 전문의 |
| `departmentCode` | string \| null | 의사·간호사는 O | 등록된 진료과코드. 원무는 `null`이어야 함 |
| `loginId` | string | O | 영문·숫자 4~20자, 의료진 안에서 중복 불가 |
| `password` | string | O | 8~64자, 영문과 숫자를 모두 포함 |

```json
{
  "name": "윤채아",
  "phone": "010-5550-0177",
  "jobType": "의사",
  "position": "전문의",
  "departmentCode": "PD",
  "loginId": "cayoon",
  "password": "chaea2026"
}
```

**응답 `201 Created`**: [의료진 객체](#의료진-객체)

**오류**

| 상태 | code | 언제 |
| --- | --- | --- |
| 400 | `VALIDATION_FAILED` | 칸별 규칙 위반, 의사·간호사인데 진료과가 없음, 원무인데 진료과가 있음, 없는 진료과코드 |
| 401, 403 | | 공통 |
| 409 | `LOGIN_ID_TAKEN` | 다른 의료진이 쓰는 아이디. `details`에 쓰는 사람: `{ "staffId": 12, "name": "박지훈" }` |

**규칙**

- 의료진.로그인ID와 비밀번호해시는 NOT NULL이라 등록할 때 반드시 정합니다. 첫 로그인 비밀번호 변경은 없습니다(11. 18 결정).
- 의사·간호사는 진료과가 필수이고 원무는 진료과가 NULL입니다.

---

## 1-13. 의료진 정보 수정

| 항목 | 내용 |
| --- | --- |
| 요청 | `PATCH /api/staff/{staffId}` |
| 권한 | 의사·간호사 |
| 화면 | S8b 의료진 계정 |
| 순위 | 3 |

**요청 본문**: 고친 필드만 보냅니다.

| 필드 | 타입 | 규칙 |
| --- | --- | --- |
| `name` | string | 1~50자 |
| `phone` | string | 숫자와 하이픈만, 20자 이내 |
| `position` | string \| null | 20자 이내. `null`이면 비움 |

**응답 `200 OK`**: [의료진 객체](#의료진-객체)

**오류**: 400 `VALIDATION_FAILED`, 401, 403, 404 `NOT_FOUND`

**규칙**

- 직종, 진료과, 로그인ID는 고칠 수 없습니다. 직종을 바꾸면 진료일정·주치의의 '의사만' 규칙이 깨질 수 있고, 진료과를 바꾸면 그 의사에게 잡힌 예약의 진료과가 함께 바뀌기 때문입니다.
- 삭제는 없습니다. 일정·진료·검사·입원이 의료진을 참조하므로 지울 수 없고, 퇴사자 처리는 이번 범위에서 다루지 않습니다.

---

## 1-14. 진료과 추가·수정·삭제

| 항목 | 내용 |
| --- | --- |
| 요청 | `POST /api/departments`, `PATCH /api/departments/{departmentCode}`, `DELETE /api/departments/{departmentCode}` |
| 권한 | 의사·간호사 |
| 화면 | S8a 기준 정보: 진료과 |
| 순위 | 3 |

**추가 `POST /api/departments` → `201 Created`**

| 필드 | 타입 | 필수 | 규칙 |
| --- | --- | --- | --- |
| `departmentCode` | string | O | 영문 대문자·숫자 1~10자 |
| `name` | string | O | 1~50자 |
| `location` | string \| null | | 100자 이내 |
| `phone` | string \| null | | 20자 이내 |

```json
{ "departmentCode": "DM", "name": "피부과", "location": "별관 2층", "phone": null }
```

응답은 [1-7](#1-7-진료과-목록)의 항목 하나와 같은 모양입니다(`staffCount`는 0).

**수정 `PATCH /api/departments/{departmentCode}` → `200 OK`**: `name`, `location`, `phone` 중 고친 것만 보냅니다. 진료과코드는 고칠 수 없습니다.

**삭제 `DELETE /api/departments/{departmentCode}` → `204 No Content`**

**오류**

| 상태 | code | 언제 |
| --- | --- | --- |
| 400 | `VALIDATION_FAILED` | 규칙 위반, 코드를 고치려 함 |
| 401, 403 | | 공통 |
| 404 | `NOT_FOUND` | 없는 진료과코드 (수정·삭제) |
| 409 | `CODE_TAKEN` | 같은 진료과코드가 이미 있음 (추가) |
| 409 | `IN_USE` | 소속 의료진이 있어 삭제할 수 없음. `details.count`에 의료진 수 |

**규칙**

- 진료과코드는 PK이면서 의료진의 FK라 만든 뒤에는 잠급니다.
- 참조 중인 진료과는 삭제할 수 없습니다(ON DELETE RESTRICT). DB 오류 문구 대신 사용 건수를 돌려줍니다.
