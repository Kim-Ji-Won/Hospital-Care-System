# frontend

병원 예약·진료 관리 시스템의 시연용 프론트엔드입니다. 화면은 Figma UI 설계서 v5, API는 [`docs/api`](../docs/api)를 따릅니다.

- Next.js 16 (App Router) · React 19 · TypeScript
- Tailwind CSS 4 (Figma 디자인 토큰을 `src/app/globals.css`의 `@theme`에 정의)
- TanStack Query (조회 화면의 로딩·비어 있음·오류 상태)
- MSW (백엔드가 아직 없는 API를 브라우저에서 대신 응답하는 목 서버)

## 실행

```bash
npm install
cp .env.example .env.local   # 처음 한 번
npm run dev                  # http://localhost:3000
```

### 목 서버 계정

비밀번호는 모두 `demo1234`입니다. 화면 오른쪽 아래 **시연** 패널의 빠른 로그인으로도 고를 수 있습니다. 실제 백엔드에 연결하면 백엔드 시드 계정을 씁니다.

| 로그인 탭 | 아이디 | 이름 | 역할 |
| --- | --- | --- | --- |
| 환자 | `seoyeon01` | 김서연 (#10234) | 환자 |
| 환자 | `haneul68` | 정하늘 (#10388) | 환자 |
| 환자 | `seohyun` | 김서현 (#09412) | 환자 |
| 의료진 | `jhpark` | 박지훈 | 의사 · 내과 |
| 의료진 | `dylee` | 이도윤 | 의사 · 내과 |
| 의료진 | `mjkang` | 강민재 | 의사 · 정형외과 |
| 의료진 | `ynchoi` | 최유나 | 간호사 · 내과 |
| 의료진 | `smlee` | 이수민 | 원무 |

## 백엔드 연결

브라우저의 `/api/*` 요청은 Next.js `rewrites`로 `BACKEND_URL`(기본 `http://localhost:8080`)에 그대로 넘어갑니다. 같은 주소로 보이므로 CORS 설정이 필요 없습니다.

`.env.local`의 `NEXT_PUBLIC_API_MOCKING`으로 목 서버 범위를 정합니다.

| 값 | 동작 |
| --- | --- |
| `all` (기본) | 모든 API를 목 서버가 응답 |
| `none` | 목 서버를 끄고 모두 실제 백엔드로 |
| `member,reservation` | 적은 영역만 목 서버, 나머지는 실제 백엔드로. 영역 이름은 `docs/api` 파일 이름과 같음 |

백엔드 담당자가 API를 끝내면 그 영역을 목록에서 빼서 하나씩 실제로 연결합니다.

## 시연 패널

오른쪽 아래 **시연** 버튼을 누르면 열립니다. `NEXT_PUBLIC_DEMO_PANEL=off`면 숨겨집니다.

- **화면 상태**: 조회 화면을 기본·로딩·비어 있음·오류로 바꿔, 설계서의 네 가지 상태를 그대로 보여 줍니다. 실제 백엔드와 연결해도 동작합니다.
- **빠른 로그인**: 목 서버 계정으로 환자·의사·간호사·원무 역할을 바로 바꿉니다.
- **목 데이터 되돌리기**: 목 서버 데이터(브라우저 localStorage)를 처음 상태로 돌립니다.

## 폴더

```text
src/
├─ app/
│  ├─ login/            P0·P0a 로그인·회원가입
│  ├─ (patient)/        환자 화면 (상단 메뉴): /, /book, /reservations, /records, /results, /payments, /admission
│  └─ staff/            의료진 화면 (사이드바, 직종별 메뉴): today, encounters, patients, labs, admissions, billing, schedules, master
├─ components/          공통 UI(ui.tsx), 화면 틀, 네 가지 상태(query-view.tsx), 시연 패널
├─ lib/
│  ├─ api/              API 호출 함수와 타입. 파일은 docs/api와 1:1 (member.ts = 01-member.md)
│  ├─ auth.tsx          로그인 상태(1-3)와 역할별 첫 화면
│  └─ demo.ts           시연 패널 설정, 목 서버 범위
└─ mocks/               MSW 목 서버: 메모리 DB(db.ts)와 영역별 핸들러
```

## 화면 추가 순서

1. `src/lib/api/`에 그 영역의 API 함수와 타입을 추가 (명세 번호를 주석으로)
2. `src/mocks/handlers/`에 같은 영역의 목 핸들러를 추가하고 `src/mocks/browser.ts`에 등록
3. 화면은 `useQuery` + `QueryView`로 기본 상태만 그리고, 로딩·비어 있음·오류는 `QueryView`에 맡김
