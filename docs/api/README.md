# API 명세

병원 예약·진료 관리 시스템의 프론트엔드(Next.js)와 백엔드(Spring Boot)가 주고받는 API 약속입니다. 프론트엔드가 화면 설계와 통합 ERD를 바탕으로 먼저 쓰고, 백엔드 담당자가 이 명세에 맞춰 구현합니다.

- **기준 문서**: 통합 ERD·테이블정의서 수정본(2026. 11. 18), UI 설계서 v5(Figma), 백엔드 업무분담서(2026. 11. 19)
- **현재 버전**: v0.1 (2026. 11. 20)
- **고치는 방법**: 이 폴더는 PR로만 고칩니다. 그 파일의 담당자가 리뷰하고, 바뀐 내용은 맨 아래 [변경 기록](#변경-기록)에 남깁니다.

## 담당과 파일

백엔드 업무분담서의 담당 테이블을 기준으로 파일을 나눴습니다. 파일 하나는 담당자 한 명이 맡습니다.

| 담당 | 업무 범위 | 담당 테이블 | 파일 |
| --- | --- | --- | --- |
| 배성진 | 환자·직원 계정, 공통 권한 확인, 진료과·일정·휴진·예약 | patient, staff, department, schedule, day_off, reservation | [01-member.md](01-member.md), [02-reservation.md](02-reservation.md) |
| 박지수 | 외래·회진, 진단, 처방·검사와 관련 기준 정보 | encounter, diagnosis, disease, prescription, prescription_item, drug, exam, exam_item | [03-encounter.md](03-encounter.md), [04-order.md](04-order.md) |
| 김지원 | 병실·입퇴원, 진료비 산정, 원무 수납·취소 | room, admission, payment | [05-admission.md](05-admission.md), [06-payment.md](06-payment.md) |

기준 정보는 테이블 담당자를 따라갑니다. 진료과는 01, 질병·약품·검사항목은 04, 병실은 05에 있습니다.

## 우선순위

시연은 실제 백엔드와 연결해서 합니다. 백엔드도 아래 순서로 만들어 주세요. 같은 순위 안에서는 [전체 API 목록](#5-전체-api-목록)의 위에서부터 만들면 화면 흐름과 순서가 같습니다.

| 순위 | 범위 | 화면 |
| --- | --- | --- |
| 1 | 외래 예약부터 수납까지 (시연 핵심) | P0·P0a, P1, P2, P3, S1, S2·S2a, S4·S4a, S6, P4·P5·P6 |
| 2 | 입원부터 퇴원까지 | S5·S5a·S5b, S2b, P1a |
| 3 | 관리 화면 | P3a, S3·S3a·S3b, S6b, S7·S7a·S7b, S8·S8a·S8b, S9 |

---

## 1. 기본 규칙

### 주소

- 모든 API는 `/api`로 시작합니다. 백엔드 컨트롤러도 `/api`부터 경로를 잡습니다.
- 프론트엔드는 브라우저의 `/api/*` 요청을 Next.js `rewrites`로 백엔드에 그대로 넘깁니다. 백엔드 주소는 프론트엔드 환경변수 `BACKEND_URL`(기본 `http://localhost:8080`)로 정합니다. 브라우저에는 같은 주소로 보이므로 **CORS 설정이 필요 없습니다.**
- 경로는 테이블 영문 이름의 복수형을 kebab-case로 씁니다. 쿼리 이름은 camelCase입니다.

| 경로 | 테이블 |
| --- | --- |
| `/api/patients` | patient (환자) |
| `/api/staff` | staff (의료진) |
| `/api/departments` | department (진료과) |
| `/api/schedules`, `/api/day-offs` | schedule (진료일정), day_off (휴진) |
| `/api/reservations` | reservation (예약) |
| `/api/encounters` | encounter (진료) + diagnosis·prescription·prescription_item (함께 저장) |
| `/api/exams` | exam (검사) |
| `/api/diseases`, `/api/drugs`, `/api/exam-items` | disease (질병), drug (약품), exam_item (검사항목) |
| `/api/admissions`, `/api/rooms` | admission (입원), room (병실) |
| `/api/payments` | payment (결제) |

- 예외 두 가지:
  - **환자 본인 데이터는 `/api/me/...`** 아래에 둡니다. 환자번호를 경로나 쿼리로 받지 않고 세션에서 꺼냅니다. 테이블정의서의 "환자는 본인 데이터만 조회" 규칙을 경로로 지키는 방식입니다.
  - 테이블 하나에 대응하지 않는 계산 결과는 하는 일 이름을 씁니다. 예: 예약 가능 시간 `/api/booking/slots`
- 상태를 바꾸는 일은 `PATCH`로 상태값을 고치지 않고 **동작 이름 경로**를 씁니다. 예: `POST /api/reservations/{reservationId}/no-show`. 상태 순서 검사와 그때 함께 일어나는 일(결제 자동 생성 등)을 서버 한 곳에서 처리하기 위해서입니다.

### 요청과 응답

- 본문은 JSON(UTF-8)입니다.
- 필드 이름은 camelCase이고, 컬럼 이름을 그대로 바꿉니다. `patient_id` → `patientId`, `appointment_at` → `appointmentAt`, `room_no` → `roomNo`
- NULL인 컬럼도 필드를 빼지 않고 `null`로 보냅니다.
- `PATCH`는 보낸 필드만 고칩니다. 보내지 않은 필드는 그대로 두고, NULL을 허용하는 컬럼에 `null`을 보내면 값을 비웁니다.
- 목록은 JSON 배열을 그대로 돌려줍니다. 시연 데이터가 작아서 페이지 나눔은 없습니다. 화면 요약이 함께 필요한 몇 API만 객체로 감싸고, 해당 API에 적어 둡니다.
- 상태 코드: 생성은 `201 Created`, 조회·수정·상태 변경은 `200 OK`, 돌려줄 내용이 없으면 `204 No Content`
- "오늘"과 "지금"은 서버의 한국 시간 기준입니다.

### 값 표기

| 종류 | 표기 | 예 |
| --- | --- | --- |
| DATETIME | `YYYY-MM-DDTHH:mm:ss` (한국 시간, 시간대 표기 없음) | `"2026-11-11T10:00:00"` |
| DATE | `YYYY-MM-DD` | `"1994-03-12"` |
| TIME | `HH:mm:ss` | `"09:00:00"` |
| 금액 (INT, 원) | 정수 | `38500` |
| DECIMAL | 숫자 | `1.5` |
| CHAR(1) `'Y'`/`'N'` | boolean | 진단.주진단여부 → `"isPrimary": true` |
| ENUM | DB 값(한글) 그대로 | `"status": "예약"` |

### ENUM 값

| 컬럼 | JSON 필드 | 값 |
| --- | --- | --- |
| 환자.성별 | `gender` | 남, 여 |
| 의료진.직종 | `jobType` | 의사, 간호사, 원무 |
| 진료일정.요일 | `dayOfWeek` | 월, 화, 수, 목, 금, 토, 일 |
| 예약.예약상태 | `status` | 예약, 취소, 완료, 노쇼 |
| 진료.진료구분 | `encounterType` | 외래, 입원 |
| 처방전.처방구분 | `dispenseType` | 원내, 원외 |
| 검사.검사상태 | `status` | 요청, 시행, 완료 |
| 검사.판정 | `resultFlag` | 정상, 이상 |
| 검사항목.검사분류 | `category` | 혈액, 영상, 기능 |
| 결제.결제수단 | `method` | 카드, 현금, 계좌이체 |
| 결제.결제상태 | `status` | 미결제, 완료, 취소 |

DB에 없고 API에만 있는 값:

| 필드 | 값 | 뜻 |
| --- | --- | --- |
| `accountType` | 환자, 의료진 | 로그인할 때 어느 계정 테이블에서 찾을지 |
| `role` | 환자, 의사, 간호사, 원무 | 로그인한 사용자. 의료진이면 직종과 같음 |
| `billingType` | 외래, 입원 | 결제가 외래 청구인지, 퇴원 때 만든 입원 통합 청구인지 |

### 공통 객체

**환자 요약 (`patient`)**: 목록이나 요약에서 환자를 가리킬 때 씁니다. 나이는 프론트엔드가 생년월일로 계산합니다.

```json
{ "patientId": 10234, "name": "김서연", "birthDate": "1994-03-12", "gender": "여" }
```

의사·진료과처럼 이름만 필요한 참조는 객체로 감싸지 않고 `doctorId`, `doctorName`, `departmentCode`, `departmentName`처럼 번호와 이름을 펼쳐 씁니다.

### 서버가 정하는 값

아래 값은 요청에 넣지 않고 서버가 정합니다. 예외가 있으면 해당 API에 적습니다.

- AUTO_INCREMENT 번호: 환자번호, 의료진번호, 일정번호, 휴진번호, 예약번호, 진료번호, 처방번호, 검사번호, 입원번호, 결제번호 (병실번호는 사람이 입력)
- 등록·생성 시각: 예약.등록일시, 결제.생성일시, 처방전.처방일시, 진료.진료일시(외래는 진료 기록을 저장한 시각, 회진은 [3-1](03-encounter.md#3-1-진료-기록-저장) 참고)
- 상태를 바꾼 시각: 검사.요청일시·시행일시, 결제.결제일시, 입원.입원일시 (버튼을 누른 시각)
- 예약에 배정되는 일정번호 (비어 있는 일정 중 무작위)
- 결제.청구비용 ([06 청구 금액 계산](06-payment.md#청구-금액-계산))
- 검사.판독자번호 (로그인한 의사)

### 고정값

| 이름 | 값 | 근거 |
| --- | --- | --- |
| 진찰료 | 15,000원 | 테이블정의서 결제 규칙의 "고정 금액, 백엔드 상수". Figma S6 시안에서 진찰만 있는 외래 청구 금액과 같게 정함 |

---

## 2. 인증과 권한

- **세션 쿠키 방식**입니다. 로그인에 성공하면 백엔드가 세션을 만들고 `JSESSIONID` 쿠키를 내려 줍니다. 그 뒤 요청은 이 쿠키로 사용자를 알아봅니다. 로그아웃하면 세션을 끝냅니다. 세션 유효 시간은 Spring 기본값(30분)입니다.
- 계정 테이블이 환자와 의료진 두 개라서, 로그인할 때 `accountType`으로 어느 테이블에서 찾을지 고릅니다. 원무 직원은 의료진으로 로그인합니다.
- 로그인한 사용자의 번호·직종·진료과를 꺼내는 공통 기능은 배성진님이 만들고, 다른 담당자는 이 기능으로 권한을 확인합니다([연결 지점](#6-백엔드-연결-지점) 참고).

권한 칸의 표기:

| 표기 | 호출할 수 있는 사용자 |
| --- | --- |
| 없음 | 로그인하지 않아도 됨 |
| 로그인 | 로그인한 누구나 |
| 환자 | 환자 계정 |
| 의사, 간호사, 원무 | 의료진 계정 중 그 직종. 여러 직종이면 `·`로 이어 씀 |

직종별로 할 수 있는 일 (테이블정의서 규칙과 UI 설계서 기준):

| 일 | 직종 |
| --- | --- |
| 진료 기록·진단·처방·검사 요청 작성, 검사 판독(완료 처리) | 의사 |
| 진료 기록 수정 | 그 기록을 작성한 의사 |
| 수납, 결제 취소 | 원무 |
| 검사 시행, 입원·병실, 진료일정·휴진, 기준 정보, 의료진 계정 | 의사·간호사 |
| 환자 조회·정보 수정 | 의사·간호사·원무 (원무 사이드바에도 '환자' 메뉴가 있음) |
| 예약 만들기·변경·취소 | 환자 본인만 (예약제 전용, 의료진 화면에는 예약 등록이 없음) |

- 로그인하지 않았거나 세션이 끝났으면 `401 UNAUTHENTICATED`, 권한이 없으면 `403 FORBIDDEN`을 돌려줍니다.
- 프론트엔드는 401이면 로그인 화면으로(S9 세션 만료), 403이면 권한 없음 화면으로 보냅니다.

---

## 3. 오류 응답

```json
{
  "code": "VALIDATION_FAILED",
  "message": "입력값을 확인하세요.",
  "fields": [
    { "field": "loginId", "reason": "영문·숫자 4~20자로 입력하세요." }
  ],
  "details": null
}
```

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `code` | string | 영문 대문자 오류 코드. 프론트엔드는 이 값으로 화면 문구를 고릅니다. |
| `message` | string | 개발 확인용 한국어 한 줄. 화면에 그대로 띄우지 않습니다. |
| `fields` | array \| null | `VALIDATION_FAILED`일 때만 씀. 칸 이름(`field`)과 이유(`reason`). 목록 안의 칸은 `prescriptions[0].items[1].dose`처럼 씀 |
| `details` | object \| null | 코드별 추가 정보. 쓰는 API에 내용을 적어 둡니다. 예: `IN_USE`의 사용 건수 |

공통 오류 코드:

| 상태 | code | 언제 |
| --- | --- | --- |
| 400 | `VALIDATION_FAILED` | 필수값이 빠졌거나 형식·길이·범위가 틀림 |
| 401 | `UNAUTHENTICATED` | 로그인하지 않았거나 세션이 끝남 |
| 403 | `FORBIDDEN` | 직종 권한이 없거나 남의 데이터 |
| 404 | `NOT_FOUND` | 그 번호·코드의 데이터가 없음 |
| 409 | `INVALID_STATUS` | 상태 순서에 맞지 않는 변경. 예: '완료'된 예약 취소, '요청' 검사를 바로 '완료' |
| 409 | `IN_USE` | 다른 데이터가 참조 중이라 삭제할 수 없음 (모든 FK가 ON DELETE RESTRICT). `details.count`에 참조 건수 |
| 409 | `CODE_TAKEN` | 기준 정보를 추가할 때 같은 코드(병실번호 포함)가 이미 있음 |
| 500 | `INTERNAL_ERROR` | 그 밖의 서버 오류 |

영역별 오류 코드(예: `LOGIN_FAILED`, `SLOT_TAKEN`)는 각 파일의 API 아래에 있습니다.

---

## 4. API 항목 읽는 법

각 API는 같은 순서로 씁니다.

1. 요약 표: 요청(메서드·경로), 권한, 화면, 순위
2. 설명
3. 요청: 경로 변수, 쿼리, 본문
4. 응답: 상태 코드와 예시 JSON, 필드 설명
5. 오류: 이 API에서 나는 오류 코드
6. 규칙: 지켜야 할 테이블정의서 규칙과 결정 사항
7. 백엔드 메모: 구현할 때 참고할 순서·쿼리

타입 표기는 `string`, `number`, `boolean`, `date`, `datetime`, `time`, `object`, `array`를 씁니다. ENUM은 `'예약' | '취소'`처럼, NULL이 될 수 있으면 `| null`을 붙입니다.

---

## 5. 전체 API 목록

57개 중 순위 1이 26개입니다.

### 01 회원 관리 · 배성진 ([01-member.md](01-member.md))

| 번호 | 요청 | 권한 | 화면 | 순위 |
| --- | --- | --- | --- | --- |
| 1-1 | `POST /api/auth/login` | 없음 | P0 | 1 |
| 1-2 | `POST /api/auth/logout` | 없음 | 공통 | 1 |
| 1-3 | `GET /api/auth/me` | 로그인 | 공통 | 1 |
| 1-4 | `POST /api/auth/signup` | 없음 | P0a | 1 |
| 1-5 | `GET /api/me/profile` | 환자 | P1 | 1 |
| 1-6 | `GET /api/patients/{patientId}` | 의사·간호사·원무 | S1, S2, S3, S6 | 1 |
| 1-7 | `GET /api/departments` | 로그인 | P2, S8a, S8b | 1 |
| 1-8 | `GET /api/staff` | 의사·간호사 | S5a, S7, S8b | 2 |
| 1-9 | `GET /api/patients` | 의사·간호사·원무 | S3 | 3 |
| 1-10 | `PATCH /api/patients/{patientId}` | 의사·간호사·원무 | S3a | 3 |
| 1-11 | `GET /api/patients/{patientId}/history` | 의사·간호사·원무 | S3b | 3 |
| 1-12 | `POST /api/staff` | 의사·간호사 | S8b | 3 |
| 1-13 | `PATCH /api/staff/{staffId}` | 의사·간호사 | S8b | 3 |
| 1-14 | `POST /api/departments`, `PATCH·DELETE /api/departments/{departmentCode}` | 의사·간호사 | S8a | 3 |

### 02 예약 관리 · 배성진 ([02-reservation.md](02-reservation.md))

| 번호 | 요청 | 권한 | 화면 | 순위 |
| --- | --- | --- | --- | --- |
| 2-1 | `GET /api/booking/dates` | 환자 | P2, P3a | 1 |
| 2-2 | `GET /api/booking/slots` | 환자 | P2, P3a | 1 |
| 2-3 | `POST /api/me/reservations` | 환자 | P2 | 1 |
| 2-4 | `GET /api/me/reservations` | 환자 | P1, P3 | 1 |
| 2-5 | `GET /api/reservations` | 의사·간호사 | S1, S9 | 1 |
| 2-6 | `GET /api/reservations/{reservationId}` | 의사·간호사 | S2 | 1 |
| 2-7 | `POST /api/reservations/{reservationId}/no-show` | 의사·간호사 | S1 | 1 |
| 2-8 | `PATCH /api/me/reservations/{reservationId}` | 환자 | P3a | 3 |
| 2-9 | `POST /api/me/reservations/{reservationId}/cancel` | 환자 | P3a | 3 |
| 2-10 | `GET /api/schedules` | 의사·간호사 | S7 | 3 |
| 2-11 | `POST /api/schedules` | 의사·간호사 | S7 | 3 |
| 2-12 | `PATCH /api/schedules/{scheduleId}` | 의사·간호사 | S7b | 3 |
| 2-13 | `DELETE /api/schedules/{scheduleId}` | 의사·간호사 | S7b | 3 |
| 2-14 | `GET /api/day-offs` | 의사·간호사 | S7, S7a, S7b | 3 |
| 2-15 | `GET /api/day-offs/impact` | 의사·간호사 | S7a | 3 |
| 2-16 | `POST /api/day-offs` | 의사·간호사 | S7a | 3 |
| 2-17 | `DELETE /api/day-offs/{dayOffId}` | 의사·간호사 | S7b | 3 |

### 03 진료 관리 · 박지수 ([03-encounter.md](03-encounter.md))

| 번호 | 요청 | 권한 | 화면 | 순위 |
| --- | --- | --- | --- | --- |
| 3-1 | `POST /api/encounters` | 의사 | S2, S2a, S2b | 1 (회진은 2) |
| 3-2 | `GET /api/me/encounters` | 환자 | P4, P1a | 1 |
| 3-3 | `GET /api/encounters/{encounterId}` | 의사·간호사 | S2, S3b, S9 | 3 |
| 3-4 | `PATCH /api/encounters/{encounterId}` | 의사 (작성자) | S2 | 3 |

진단·처방전·처방상세·검사 요청은 3-1에서 진료와 함께 한 번에 저장합니다.

### 04 처방·검사 관리 · 박지수 ([04-order.md](04-order.md))

| 번호 | 요청 | 권한 | 화면 | 순위 |
| --- | --- | --- | --- | --- |
| 4-1 | `GET /api/exams` | 의사·간호사 | S4 | 1 |
| 4-2 | `POST /api/exams/{examId}/perform` | 의사·간호사 | S4 | 1 |
| 4-3 | `POST /api/exams/{examId}/complete` | 의사 | S4a | 1 |
| 4-4 | `GET /api/me/exams` | 환자 | P1, P5 | 1 |
| 4-5 | `GET /api/diseases` | 의사·간호사 | S2a, S8a | 1 |
| 4-6 | `GET /api/drugs` | 의사·간호사 | S2a, S8 | 1 |
| 4-7 | `GET /api/exam-items` | 의사·간호사 | S2a, S8a | 1 |
| 4-8 | `POST /api/diseases`, `PATCH·DELETE /api/diseases/{diseaseCode}` | 의사·간호사 | S8a | 3 |
| 4-9 | `POST /api/drugs`, `PATCH·DELETE /api/drugs/{drugCode}` | 의사·간호사 | S8 | 3 |
| 4-10 | `POST /api/exam-items`, `PATCH·DELETE /api/exam-items/{examCode}` | 의사·간호사 | S8a | 3 |

### 05 입·퇴원 관리 · 김지원 ([05-admission.md](05-admission.md))

| 번호 | 요청 | 권한 | 화면 | 순위 |
| --- | --- | --- | --- | --- |
| 5-1 | `GET /api/rooms` | 의사·간호사 | S5, S5a, S8a | 2 |
| 5-2 | `GET /api/admissions/pending` | 의사·간호사 | S5, S5a | 2 |
| 5-3 | `POST /api/admissions` | 의사·간호사 | S5a | 2 |
| 5-4 | `GET /api/admissions` | 의사·간호사 | S5, S5b | 2 |
| 5-5 | `GET /api/admissions/{admissionId}` | 의사·간호사 | S2b, S5b | 2 |
| 5-6 | `POST /api/admissions/{admissionId}/discharge` | 의사·간호사 | S5b | 2 |
| 5-7 | `GET /api/me/admissions` | 환자 | P1, P1a | 2 |
| 5-8 | `POST /api/rooms`, `PATCH·DELETE /api/rooms/{roomNo}` | 의사·간호사 | S8a | 3 |

### 06 결제 관리 · 김지원 ([06-payment.md](06-payment.md))

| 번호 | 요청 | 권한 | 화면 | 순위 |
| --- | --- | --- | --- | --- |
| 6-1 | `GET /api/payments` | 원무 | S6, S6b | 1 |
| 6-2 | `POST /api/payments/{paymentId}/pay` | 원무 | S6 | 1 |
| 6-3 | `GET /api/me/payments` | 환자 | P1, P6 | 1 |
| 6-4 | `POST /api/payments/{paymentId}/cancel` | 원무 | S6b | 3 |

결제를 만드는 API는 없습니다. 진료 저장(3-1), 퇴원 처리(5-6), 결제 취소(6-4) 때 서버가 '미결제'로 자동 생성합니다.

---

## 6. 백엔드 연결 지점

업무분담서의 "개발 전에 세 사람이 맞출 지점"을 API 기준으로 옮긴 표입니다. HTTP API가 아니라 백엔드 안에서 서로 부르는 기능(서비스 메서드)이고, 이름과 인자는 담당자끼리 정합니다.

| 연결 | 부르는 쪽 | 만드는 쪽 | 맞출 내용 |
| --- | --- | --- | --- |
| 로그인 사용자 확인 | 모든 API | 배성진 | 세션에서 번호·`role`·진료과를 꺼내는 기능. 의사 전용 작성(박지수), 원무 전용 수납(김지원) 검사에 씀 |
| 예약 → 외래 진료 | 박지수 (3-1) | 배성진 | 예약번호로 환자·상태를 확인하고(2-6과 같은 내용), 진료 저장 트랜잭션 안에서 예약을 '완료'로 바꿈. 진료 저장이 실패하면 예약도 그대로 남음 |
| 진료 저장 → 외래 청구 | 박지수 (3-1) | 김지원 | 입원 결정이 아닌 외래면 같은 트랜잭션에서 청구 생성 기능을 부름. 입원 결정이면 부르지 않음(퇴원 때 청구) |
| 입원 결정 → 재입원 막기 | 박지수 (3-1) | 김지원 | 환자가 지금 입원 중인지 확인 |
| 배정 대기 목록 | 김지원 (5-2) | 박지수 | 결제도 입원도 없는 외래 진료 조회 |
| 회진 기록 → 입원 확인 | 박지수 (3-1 회진) | 김지원 | 입원번호로 환자·입원일시를 확인하고 퇴원 전인지 확인 |
| 청구 금액 계산 | 김지원 (3-1에서 부를 때, 5-6, 6-4) | 박지수 | 진료번호별 요청 검사(검사항목.검사비)와 원내 처방상세(약품.단가) 조회 |
| 환자 요약·이력 | 배성진 (1-6, 1-11) | 박지수, 김지원 | 최근 진료(진료·진단·질병), 입원 중 여부(입원·병실), 검사·결제 이력 조회 |

**공동 완료 시나리오의 API 순서** (업무분담서 3쪽)

1. 환자가 예약 (2-3, 배성진)
2. 의사가 외래 진료를 저장하며 입원 결정 (3-1, `admissionDecided: true`, 박지수). 예약 '완료', 결제는 만들지 않음
3. 병실 배정 (5-2 → 5-3, 김지원)
4. 회진에서 검사와 원내 처방 등록 (3-1 회진, 박지수)
5. 퇴원 전에는 그 환자의 미결제가 없는지 확인 (6-1)
6. 퇴원 처리 (5-6, 김지원). 최초 외래 진료에 통합 청구 1건 생성
7. 원무 계정으로 수납 (6-2) → 결제 취소 (6-4). 취소 1건과 새 미결제 1건이 남는지 확인

---

## 7. Spring Boot 구현 메모

- **세션**: `HttpSession`과 인터셉터로 직접 처리해도 되고 Spring Security를 써도 됩니다. Spring Security를 쓰면 두 가지를 꼭 설정합니다.
  - CSRF 끄기: `http.csrf(csrf -> csrf.disable())`. 켜 두면 프론트엔드의 POST 요청이 모두 403이 됩니다.
  - 401·403도 [오류 응답](#3-오류-응답) 형식의 JSON으로 내려 주도록 `AuthenticationEntryPoint`, `AccessDeniedHandler`를 설정합니다. 기본 응답은 HTML이거나 본문이 비어 있습니다.
- **비밀번호**: BCrypt로 해시합니다. Spring Security 전체를 쓰지 않아도 `spring-security-crypto`의 `BCryptPasswordEncoder`만 쓸 수 있습니다. 해시는 60자라 `VARCHAR(255)`에 들어갑니다.
- **한글 ENUM**: JPA의 `@Enumerated(EnumType.STRING)`은 Java 상수 이름을 그대로 저장합니다. 상수를 영어로 만들면 DB의 `ENUM('예약', …)`과 맞지 않아 저장이 실패합니다. `AttributeConverter`로 한글 값과 매핑하거나 `String` 필드로 두고, JSON에도 한글 값이 나가게 합니다(`@JsonValue` 등).
- **날짜**: `LocalDateTime`, `LocalDate`, `LocalTime`을 씁니다. Spring Boot 기본 Jackson 설정이면 [값 표기](#값-표기)와 같은 형식이 나옵니다. JDBC URL에 `serverTimezone=Asia/Seoul`을 넣어 시각이 밀리지 않게 합니다.
- **null 필드**: Jackson의 `NON_NULL` 설정을 켜지 마세요. NULL도 필드를 남겨 `null`로 보내야 합니다.
- **오류 처리**: 업무 규칙 위반은 예외로 던지고 `@RestControllerAdvice` 한 곳에서 오류 응답으로 바꿉니다. DB 제약 위반(UNIQUE 등)도 여기서 해당 오류 코드로 바꾸고, DB 오류 문구를 그대로 내보내지 않습니다.
- **트랜잭션**: 여러 테이블을 함께 쓰는 API(진료 저장, 휴진 등록, 병실 배정, 퇴원 처리, 결제 취소)는 `@Transactional` 하나로 묶습니다.
- **동시 요청**: 같은 자리를 두 요청이 동시에 잡는 곳(예약의 마지막 한 자리, 병실의 마지막 병상)은 DB UNIQUE 위반을 잡아 다시 시도하거나, 행 잠금(`SELECT … FOR UPDATE`)으로 막습니다. 각 API의 백엔드 메모에 적어 두었습니다.
- **규칙 검사**: 테이블정의서에서 '규칙'으로 적은 줄은 DB 제약이 아니라 애플리케이션에서 검사합니다. 각 API의 "규칙"에 어느 줄인지 적어 두었습니다.
- **시드 데이터**: 역할을 이렇게 나눕니다.
  - 프론트엔드: 시연에 필요한 데이터 목록(진료과, 의사·간호사·원무 계정, 진료일정, 병실, 약품, 질병, 검사항목, 환자·예약 몇 건)을 시연 시나리오와 함께 정해 `docs/frontend/demo-scenario.md`에 올립니다(예정). 프론트엔드 목 데이터도 이 목록을 씁니다.
  - 백엔드: 이 목록을 보고 INSERT SQL을 만듭니다. 계정 비밀번호 해시는 백엔드의 `BCryptPasswordEncoder`로 만들어야 로그인이 됩니다.

---

## 변경 기록

| 버전 | 날짜 | 내용 |
| --- | --- | --- |
| v0.1 | 2026-11-20 | 공통 규칙, 전체 API 57개 목록, 담당별 명세(01~06) 첫 작성. 기준 정보는 테이블 담당자 파일로 나눔 |
