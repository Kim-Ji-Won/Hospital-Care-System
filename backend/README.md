# backend

병원 예약·진료 관리 시스템의 백엔드입니다. API는 [`docs/api`](../docs/api), 테이블은 [`db/V1__init.sql`](src/main/resources/db/V1__init.sql)을 따릅니다.

- Spring Boot 4.2 · Java 21 · Gradle
- Spring Web MVC · Spring Data JPA · Validation · Lombok
- MySQL 8.4 LTS (8.0.16 이상 필수: 함수형 UNIQUE·CHECK)
- 로그인은 `HttpSession` + `HandlerInterceptor` (Spring Security 미사용, 비밀번호 해시만 `spring-security-crypto`의 BCrypt)

## 처음 한 번 준비

### 1. 설치

| 프로그램 | 버전 | 비고 |
| --- | --- | --- |
| JDK | 21 | Temurin 21 또는 IntelliJ에 들어 있는 JBR 21 |
| MySQL | 8.4 LTS | Windows는 MSI 설치, root 비밀번호 기억해 두기 |
| IntelliJ IDEA | 최신 | Community도 됨 |

`JAVA_HOME`이 JDK 21 폴더를 가리키는지 확인합니다. Windows 속성 창에서 경로를 복사해 붙이면 맨 앞에 **보이지 않는 문자**가 들어가 Gradle이 실패할 수 있으니 직접 타이핑합니다.

### 2. DB와 테이블 만들기

PowerShell을 열고 **저장소 폴더로 먼저 이동**합니다. 

```powershell
cd "<저장소 경로>\Hospital-Care-System"
```

```powershell
& "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe" -u root -p -e "CREATE DATABASE hospital DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"
```

```powershell
& "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe" --default-character-set=utf8mb4 -u root -p hospital -e "source backend/src/main/resources/db/V1__init.sql"
```

```powershell
& "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe" --default-character-set=utf8mb4 -u root -p hospital -e "SHOW TABLES;"
```

테이블 17개가 나오면 성공입니다.

- `--default-character-set=utf8mb4`를 빼면 한글 ENUM이 `?`로 깨져 `duplicated value '?' in ENUM` 오류가 납니다.
- 중간에 실패했다면 `DROP DATABASE hospital;` 후 처음부터 다시 실행합니다.
- Mac은 `mysql -u root -p hospital < backend/src/main/resources/db/V1__init.sql`

### 3. IntelliJ 설정

1. **Open** → `Hospital-Care-System/backend` 폴더를 엽니다. (저장소 전체가 아니라 `backend`)
2. Settings → Build, Execution, Deployment → Compiler → Annotation Processors → **Enable annotation processing**이 켜져 있는지 확인 (Lombok용, Gradle 프로젝트로 열면 보통 자동으로 켜져 있음)
3. Run → Edit Configurations → `BackendApplication` → **Environment variables**에 DB 계정을 넣습니다.

```text
DB_USERNAME=root;DB_PASSWORD=내비밀번호
```

DB 아이디·비밀번호는 파일에 쓰지 않고 환경변수로만 넣습니다. `DB_USERNAME`을 빼면 `root`를 씁니다. `DB_PASSWORD`를 빼면 `Access denied for user 'root'@'localhost' (using password: YES)` 오류로 서버가 시작되지 않습니다. (비밀번호 자리에 `${DB_PASSWORD}` 글자가 그대로 들어가서 YES로 나옵니다)

## 실행

IntelliJ에서 `BackendApplication`을 실행하거나, 터미널에서:

```powershell
$env:DB_PASSWORD="내비밀번호"; .\gradlew.bat bootRun
```

`http://localhost:8080`에서 시작합니다.

빌드·테스트도 DB에 접속하므로 MySQL이 켜져 있어야 하고, 터미널에서도 비밀번호를 넣어야 합니다. (IntelliJ 실행 설정의 환경변수는 터미널에 적용되지 않습니다)

```powershell
$env:DB_PASSWORD="내비밀번호"; .\gradlew.bat build
```

## 프론트엔드와 연결

프론트의 `/api/*` 요청은 Next.js가 `http://localhost:8080`으로 넘겨줍니다. CORS 설정은 필요 없습니다.

`frontend/.env.local`의 `NEXT_PUBLIC_API_MOCKING`에서 실제 백엔드로 보낼 영역을 고릅니다. 예: 회원·예약만 실제 백엔드로 보내려면 `member,reservation`. 자세한 값은 [`frontend/README.md`](../frontend/README.md)를 봅니다.

## 폴더 구조

담당자별로 도메인 폴더가 나뉩니다. 각 도메인의 `package-info.java`에 담당자와 테이블이 적혀 있습니다.

```text
com.hospital.backend
├── global/          공통 · 배성진
│   ├── error/       ErrorCode, BusinessException, 전역 예외 처리
│   ├── auth/        로그인 사용자, 로그인·직종 확인
│   ├── config/      인터셉터 등록, PasswordEncoder
│   └── converter/   한글 ENUM 변환
├── member/          01 회원 · 배성진   (patient, staff, department)
├── reservation/     02 예약 · 배성진   (schedule, day_off, reservation)
├── encounter/       03 진료 · 박지수   (encounter, diagnosis, disease)
├── order/           04 처방·검사 · 박지수 (prescription, prescription_item, drug, exam, exam_item)
├── admission/       05 입·퇴원 · 김지원 (room, admission)
└── payment/         06 결제 · 김지원   (payment)
```

도메인 폴더 안은 모두 같습니다: `controller/` · `service/` · `repository/` · `entity/` · `dto/`. 빈 폴더를 git에 올리려고 넣은 `.gitkeep`은 클래스를 만든 뒤 지워도 됩니다.

## 코드 규칙

- **응답은 DTO로.** 엔티티를 그대로 반환하지 않습니다 (비밀번호 해시가 섞이지 않게).
- **다른 도메인 데이터는 그 도메인의 Service로.** 남의 Repository를 직접 쓰지 않습니다.
- **오류는 `BusinessException(ErrorCode)`로 던집니다.** 응답 형식 `{code, message, fields, details}`은 전역 예외 처리 한 곳에서 만듭니다. ([`docs/api/README.md`](../docs/api/README.md) 3. 오류 응답)
- **한글 ENUM은 `AttributeConverter`로.** `@Enumerated(EnumType.STRING)`은 쓰지 않습니다. JSON에도 한글 값(`"예약"`)이 그대로 나갑니다.
- **날짜는 `LocalDateTime` · `LocalDate` · `LocalTime`.** 서버 시각은 KST(`serverTimezone=Asia/Seoul`).
- **여러 테이블을 바꾸는 API는 `@Transactional`.**
- **Jackson은 3.x**입니다. 패키지가 `com.fasterxml.jackson`이 아니라 `tools.jackson`이니 예전 블로그 예제의 import를 그대로 쓰지 않습니다. (어노테이션 `com.fasterxml.jackson.annotation`은 그대로)

## 테이블을 바꿀 때

- 이미 적용된 `V1__init.sql`은 **고치지 않습니다.** 변경은 `V2__설명.sql`처럼 새 파일로 추가합니다.
- `ddl-auto=none`이라 JPA가 테이블을 만들거나 바꾸지 않습니다. 엔티티만 고치면 DB에는 반영되지 않습니다.
- ERD·테이블정의서도 같은 PR에서 함께 고칩니다.

## 브랜치·PR

`main`에 직접 커밋하지 않습니다. `feat/로그인-API`처럼 `종류/작업명` 브랜치 → PR → 팀원 1명 승인 → Squash and merge → 브랜치 삭제.
