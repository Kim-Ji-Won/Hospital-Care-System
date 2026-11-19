<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# 프로젝트 규칙

병원 예약·진료 관리 시스템의 **시연용 프로토타입** 프론트엔드입니다. 과목의 중심은 ERD 설계이고, 이 앱은 그 설계를 화면으로 보여 주는 용도입니다. 과하게 만들지 않습니다.

## 기준 자료

| 무엇 | 어디 |
| --- | --- |
| 화면 | Figma UI 설계서 v5 (페이지: IA · 디자인 기준 / 환자 화면 / 의료진 화면). 화면 31개, 화면마다 기본·로딩·비어 있음·오류 4상태와 설계 근거 |
| API | 저장소의 `docs/api/` (README 공통 규칙 + 01~06 영역별 파일) |
| 데이터 규칙 | 통합 ERD·테이블정의서 수정본(2026. 11. 18) |
| 구현 순서 | 1순위 외래 예약~수납 → 2순위 입원 → 3순위 관리 화면 (`docs/api/README.md` 우선순위) |

설계와 명세가 다르면 임의로 고르지 말고 사용자에게 묻습니다.

## API

- `docs/api` 명세를 따릅니다. 명세에 없는 API를 만들거나 응답 모양을 바꾸지 않습니다. 필요하면 먼저 명세를 고치자고 제안합니다.
- API 함수는 `src/lib/api/`의 영역 파일(명세 파일과 1:1, 예: `member.ts` = `01-member.md`)에 두고, 함수마다 명세 번호(예: `1-4`)를 주석으로 답니다.
- 타입은 `src/lib/api/types.ts`에 둡니다. ENUM은 DB 한글 값 그대로(`"예약"`, `"미결제"`), 날짜는 문자열, 필드는 camelCase입니다.
- 오류는 `ApiError.code`로 화면 문구를 고릅니다. `message`를 화면에 그대로 띄우지 않습니다.
- 환자 본인 데이터는 `/api/me/...`만 씁니다. 환자 화면에서 환자번호를 경로나 쿼리로 보내지 않습니다.

## 목 서버 (MSW)

- 화면을 만들 때 같은 영역의 목 핸들러를 `src/mocks/handlers/영역.ts`에 함께 만들고 `src/mocks/browser.ts`의 `handlersByArea`에 등록합니다. 영역 이름은 `docs/api` 파일 이름과 같습니다.
- 목 핸들러도 명세의 권한(401·403), 상태 순서, 오류 코드를 지킵니다. 그래야 백엔드로 바꿔도 화면이 그대로 동작합니다.
- 목 데이터는 개발용이라 백엔드 시드와 같지 않아도 됩니다. 표본 값은 Figma 시안에서 가져옵니다.

## 데이터 조회와 저장 (TanStack Query v5)

- 서버 데이터는 TanStack Query로만 다룹니다. `useEffect` + `useState`로 서버 데이터를 직접 들고 있지 않습니다. 화면 안에서만 쓰는 상태(입력값, 선택한 탭)는 `useState`로 둡니다.
- 쿼리 키는 영역 파일의 키 묶음으로 만듭니다(예: `memberKeys.profile()`). 화면에서 배열을 직접 적지 않습니다. 로그인 정보 키는 `ME_KEY` 하나뿐입니다.
- 조회는 `useQuery`, 저장·상태 변경은 `useMutation`입니다. 저장에 성공하면 영향을 받는 목록을 `invalidateQueries`로 다시 불러옵니다. 예: 예약하기 → 내 예약 목록, 수납 → 그 환자의 결제 목록.
- **낙관적 업데이트는 쓰지 않습니다.** 의사 무작위 배정, 결제 금액, 병상 확인처럼 결과를 서버가 정하므로 서버 응답을 받은 뒤 화면을 바꿉니다.
- v5 이름을 씁니다: `gcTime`(옛 `cacheTime`), 저장 중은 `isPending`, 이전 데이터 유지는 `placeholderData: keepPreviousData`.
- 앞 데이터가 있어야 부르는 조회는 `enabled`로 막습니다.
- 기본값(`src/app/providers.tsx`): 4xx는 재시도하지 않고, 창으로 돌아와도 자동 새로고침하지 않습니다(시연 중 화면이 갑자기 바뀌지 않게).

## 화면

- 화면은 클라이언트 컴포넌트(`"use client"`)로 만듭니다. 파일 첫 주석에 화면 번호와 이름(예: `P2 예약하기`)과 쓰는 API 번호를 적습니다.
- 경로는 Figma 시안 주소창을 따릅니다. 환자 화면은 `src/app/(patient)/`, 의료진 화면은 `src/app/staff/` 아래에 둡니다.
- 조회 화면은 `QueryView`(`src/components/query-view.tsx`)로 감싸 기본 상태만 그립니다. 로딩·비어 있음·오류는 `QueryView`가 맡습니다. 비어 있음에는 이유 한 줄과 다음 행동 하나만 두고, 권한상 못 하는 일은 버튼을 두지 않습니다.
- 오류가 나도 이미 받은 데이터와 입력값은 지우지 않습니다.
- 공통 부품은 `src/components/ui.tsx`의 것을 먼저 씁니다(`Button`, `Chip`, `Card`, `TextField`, `EmptyState`, `ErrorState`, `Skeleton`). UI 라이브러리를 새로 들이지 않습니다.
- 직종별 권한은 메뉴를 숨기는 대신 버튼을 빼는 방식이 기본입니다(UI 설계서 S9). 수납만 원무 전용 메뉴입니다.

## 디자인

- 색은 `src/app/globals.css`의 `@theme` 토큰만 씁니다(`bg-navy`, `text-ink-sub`, `bg-warn-bg` 등). hex 값을 코드에 직접 쓰지 않습니다.
- 주황(`warn`)은 오류 아이콘과 테두리에만 씁니다. 상태는 `Chip`으로 색과 글자를 함께 보여 줍니다(진행 중 파랑, 끝남 녹색, 취소·노쇼 회색, 이상 주황).
- 글자 크기는 `text-step`(21), `text-title`(18), `text-item`(15), `text-body`(14), `text-caption`(11.5)만 씁니다.
- 1280px 데스크톱 웹 기준입니다. 본문 최대 폭 1200px. 모바일 레이아웃은 만들지 않습니다.

## 하지 말 것

- `next.config.ts`의 `cacheComponents`·`partialPrefetching`을 켜지 않습니다. 이 앱처럼 브라우저에서 백엔드를 부르는 구조에서는 로그인 뒤 화면 이동을 막습니다.
- Next.js 서버(Route Handler, Server Action)에 업무 로직을 두지 않습니다. `/api`는 `rewrites`로 Spring Boot 백엔드에 넘깁니다.
- 로그인 사용자를 바꿀 때 `queryClient.clear()`를 쓰지 않습니다. `useAuth().switchUser`를 씁니다(로그인 정보는 덮어쓰고 다른 데이터만 지움).
- 시드 SQL이나 백엔드 코드는 만들지 않습니다. 백엔드 담당자의 일입니다.

## 작업 도구

- **화면을 구현할 때**: Figma 공식 `figma-design-to-code` 스킬로 해당 프레임의 디자인 컨텍스트와 스크린샷을 받아 1:1로 옮깁니다. Figma MCP 연결이 필요합니다. 연결이 없으면 내장 브라우저에서 Figma 파일을 열어 `figma` 전역 객체로 프레임 텍스트를 읽습니다.
- **모든 화면을 만든 뒤**: `accessibility`·`web-quality-audit` 스킬(addyosmani/web-quality-skills)로 접근성과 품질을 한 번 점검합니다. 구현 중에는 쓰지 않습니다.
- 만든 화면은 개발 서버를 띄워 브라우저에서 직접 확인합니다. 시연 패널로 로딩·비어 있음·오류 상태와 역할 전환도 확인합니다.

## PR 전 확인

CI가 없으므로 직접 돌립니다.

```bash
npm run lint
npm run build
```

커밋 메시지는 `feat:`, `fix:`, `docs:` 뒤에 한국어로 씁니다.
