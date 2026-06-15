# Sliding Puzzle Express Server

슬라이딩 퍼즐(Sliding Puzzle) 게임의 백엔드 API 서버입니다. Node.js와 Express 프레임워크를 기반으로 구축되었으며, PostgreSQL 데이터베이스를 활용하여 사용자 인증 및 난이도별 랭킹 시스템을 관리합니다.

---

## 🚀 주요 기능

### 1. 사용자 인증 (Authentication)

- **회원가입 & 로그인:** `bcryptjs`를 사용한 비밀번호 암호화 저장 및 검증을 수행합니다.
- **하위 호환성 지원:** 레거시 평문 비밀번호로 가입된 기존 사용자가 로그인할 경우, 자동으로 암호화된 비밀번호(`bcrypt`)로 마이그레이션 및 업그레이드합니다.
- **JWT 기반 인증:** 로그인 성공 시 발급되는 JWT(JSON Web Token)를 통해 보안성이 확보된 API 접근을 지원합니다. (`/api/me`를 통한 토큰 검증 및 사용자 확인)

### 2. 점수 및 랭킹 관리 (Score & Ranking System)

- **점수 계산 알고리즘:** 난이도별 기본 점수에 기반하여 소요 시간, 이동 횟수, 사용한 힌트 수를 종합적으로 고려한 고유 감쇠(Damping) 페널티 알고리즘을 적용합니다.
- **1인 1기록 최고 점수 유지 (UPSERT):** PostgreSQL의 `ON CONFLICT` 구문과 원자적(Atomic) 쿼리를 활용하여 각 사용자가 난이도별로 단 하나의 최고 기록만을 유지할 수 있도록 설계되었습니다.
- **동점자 판정 로직:** 점수가 동일할 경우 `소요 시간(적은 순) ➔ 이동 횟수(적은 순) ➔ 힌트 개수(적은 순) ➔ 등록 시간(빠른 순) ➔ 데이터 ID(낮은 순)` 순으로 정교한 동점자 우선순위 필터링을 수행합니다.
- **상세 랭킹 조회 및 페이지네이션:** 난이도별로 정렬된 랭킹 리스트 및 내 기록의 순위(`myRank`)를 계산하여 페이지네이션 정보와 함께 제공합니다.

---

## 🛠 기술 스택

- **런타임 환경:** Node.js (v20 LTS 권장)
- **프레임워크:** Express.js
- **데이터베이스:** PostgreSQL (node-postgres / `pg` 사용)
- **인증:** JSON Web Token (`jsonwebtoken`), Bcrypt (`bcryptjs`)
- **컨테이너화:** Docker
- **CI/CD:** GitHub Actions (Docker Hub 빌드 및 원격 SSH 자동 배포)

---

## 📁 폴더 구조

```bash
sliding-puzzle-express/
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Actions CI/CD 워크플로우
├── src/
│   ├── config/
│   │   ├── corsOptions.js      # CORS 동적 허용 옵션 설정
│   │   └── database.js         # 데이터베이스 연결 및 테이블 스키마 초기화
│   ├── controllers/
│   │   ├── authController.js   # 인증 관련 HTTP 요청 검증 및 응답 처리
│   │   └── scoreController.js  # 점수 저장 및 랭킹 조회 HTTP 요청 처리
│   ├── routes/
│   │   ├── authRoutes.js       # 인증 관련 API 엔드포인트 매핑
│   │   └── scoreRoutes.js      # 점수/랭킹 관련 API 엔드포인트 매핑
│   └── services/
│       ├── authService.js      # 회원가입, 로그인, 토큰 관리 비즈니스 로직
│       └── scoreService.js     # 점수 계산 알고리즘 및 랭킹 조회 비즈니스 로직
├── Dockerfile                  # 도커 이미지 빌드 파일
├── package.json                # 프로젝트 의존성 및 스크립트 정의
├── server.js                   # 애플리케이션 시작점 (Entry Point)
└── README.md                   # 프로젝트 문서
```

---

## 🗄️ 데이터베이스 스키마

서버 구동 시 `src/config/database.js` 내의 `ensureSchema()` 함수를 통해 자동으로 테이블을 검증하고 생성합니다.

### 1. `users` (사용자 테이블)

| 컬럼명       | 타입          | 제약 조건                | 설명                           |
| :----------- | :------------ | :----------------------- | :----------------------------- |
| `id`         | `TEXT`        | `PRIMARY KEY`            | 사용자 고유 아이디 (로그인 ID) |
| `name`       | `TEXT`        | `NOT NULL`               | 사용자 닉네임                  |
| `password`   | `TEXT`        | `NOT NULL`               | 암호화된 비밀번호 해시값       |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | 가입 일시                      |

### 2. `scores` (랭킹 점수 테이블)

- 각 사용자(`user_id`)는 난이도(`difficulty`)당 하나의 레코드만 기록할 수 있도록 `(user_id, difficulty)` 유니크 인덱스가 설정되어 있습니다.

| 컬럼명         | 타입          | 제약 조건                                | 설명                               |
| :------------- | :------------ | :--------------------------------------- | :--------------------------------- |
| `score_id`     | `BIGSERIAL`   | `PRIMARY KEY`                            | 점수 기록 일련번호                 |
| `user_id`      | `TEXT`        | `REFERENCES users(id) ON DELETE CASCADE` | 사용자 고유 아이디 외래키          |
| `difficulty`   | `SMALLINT`    | `CHECK (difficulty IN (3, 4, 5))`        | 퍼즐 크기 (3: 3x3, 4: 4x4, 5: 5x5) |
| `time_seconds` | `INTEGER`     | `CHECK (time_seconds >= 0)`              | 클리어 소요 시간 (초)              |
| `moves`        | `INTEGER`     | `CHECK (moves >= 0)`                     | 총 이동 횟수                       |
| `hints`        | `INTEGER`     | `CHECK (hints >= 0)`                     | 사용한 힌트 개수                   |
| `score`        | `INTEGER`     | `CHECK (score >= 0)`                     | 최종 산출 점수                     |
| `created_at`   | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()`                 | 기록 달성 일시                     |

---

## 🧮 점수 산출 알고리즘

클리어 시 전송된 데이터를 바탕으로 다음 공식에 따라 점수를 부여합니다.

1. **난이도별 기본 점수 (Base Score):**
   - 3x3: `10,000` 점
   - 4x4: `14,000` 점
   - 5x5: `18,000` 점
2. **페널티 (Penalty):**
   - $\text{Penalty} = (\text{시간} \times 10) + (\text{이동 횟수} \times 16) + (\text{힌트 횟수} \times 260)$
3. **감쇠 보너스 (Damping Bonus):**
   - 난이도가 높고 페널티가 적을수록 더 높은 감쇠 보너스를 받습니다.
   - $\text{Damping} = e^{-\frac{\text{Penalty}}{12,000}}$
   - $\text{Bonus} = \text{difficulty}^2 \times 1,200 \times \text{Damping}$ (반올림 적용)
4. **최종 점수:**
   - $\text{Final Score} = \max(0, \text{Base Score} + \text{Bonus} - \text{Penalty})$

---

## 🌐 API 명세

### 1. 회원가입

- **Endpoint:** `POST /api/signup`
- **Body:**
  ```json
  {
    "id": "player1",
    "name": "홍길동",
    "password": "securepassword123"
  }
  ```
- **Responses:**
  - `201 Created`: 회원가입 완료
  - `400 Bad Request`: 필수 항목 누락
  - `409 Conflict`: 이미 존재하는 아이디

### 2. 로그인

- **Endpoint:** `POST /api/login`
- **Body:**
  ```json
  {
    "id": "player1",
    "password": "securepassword123"
  }
  ```
- **Responses:**
  - `200 OK`: 로그인 성공 및 토큰 반환
    ```json
    {
      "message": "로그인 성공",
      "id": "player1",
      "name": "홍길동",
      "accessToken": "eyJhbGciOi..."
    }
    ```
  - `401 Unauthorized`: 일치하지 않는 자격 증명

### 3. 내 정보 조회 (토큰 검증)

- **Endpoint:** `GET /api/me`
- **Headers:** `Authorization: Bearer <accessToken>`
- **Responses:**
  - `200 OK`: 사용자 인증 완료
    ```json
    {
      "id": "player1",
      "name": "홍길동"
    }
    ```
  - `401 Unauthorized`: 만료되거나 유효하지 않은 토큰

### 4. 퍼즐 결과 점수 등록

- **Endpoint:** `POST /api/scores`
- **Body:**
  ```json
  {
    "userId": "player1",
    "difficulty": 4,
    "timeSeconds": 150,
    "moves": 50,
    "hints": 0
  }
  ```
- **Responses:**
  - `201 Created`: 점수 판정 완료 및 데이터 반환
    ```json
    {
      "message": "최고 기록이 랭킹에 반영되었습니다", // 혹은 "기존 최고 기록이 유지되었습니다"
      "score": 14120,
      "bestScore": 14120,
      "scoreId": 42,
      "rankingUpdated": true
    }
    ```
  - `400 Bad Request`: 유효하지 않은 점수/난이도 범위 데이터
  - `404 Not Found`: 사용자를 찾을 수 없음

### 5. 난이도별 랭킹 조회

- **Endpoint:** `GET /api/scores`
- **Query Parameters:**
  - `difficulty`: 퍼즐 난이도 (`3`, `4`, `5` 중 택1, 기본값 `4`)
  - `limit`: 페이지당 개수 (1~50, 기본값 `10`)
  - `page`: 조회 페이지 번호 (기본값 `1`)
  - `scoreId`: 특정 점수 ID 입력 시, 해당 기록이 전체 랭킹에서 몇 위(`myRank`)인지 추가 반환 (옵션)
- **Responses:**
  - `200 OK`: 랭킹 목록 조회 성공
    ```json
    {
      "items": [
        {
          "user_id": "player1",
          "name": "홍길동",
          "difficulty": 4,
          "time_seconds": 150,
          "moves": 50,
          "hints": 0,
          "score": 14120,
          "created_at": "2026-06-15T10:00:00.000Z"
        }
      ],
      "myRank": 1,
      "pagination": {
        "page": 1,
        "limit": 10,
        "totalCount": 1,
        "totalPages": 1
      }
    }
    ```

---

## 💻 로컬 개발 환경 실행 방법

### 1. 환경 변수 설정

프로젝트 루트 경로에 `.env` 파일을 생성하고 다음과 같이 작성합니다.

```env
PORT=3000
DATABASE_URL=postgres://username:password@localhost:5432/sliding_puzzle
JWT_SECRET=your_jwt_secret_key_here
CORS_ORIGIN=http://localhost:8080,http://localhost:5173
```

### 2. 의존성 패키지 설치

```bash
npm install
```

### 3. 개발 서버 실행

```bash
# 개발 모드 (Nodemon 감시)
npm run dev

# 일반 실행
npm run start
```

---

## 🐳 Docker 배포 가이드

### Docker 이미지 빌드

```bash
docker build -t sliding-puzzle-express .
```

### Docker 컨테이너 실행

```bash
docker run -d \
  -p 3000:8000 \
  --name sliding-puzzle-express \
  --env-file .env \
  sliding-puzzle-express
```
