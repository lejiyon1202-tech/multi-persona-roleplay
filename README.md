# multi-persona-roleplay

다중 페르소나 롤플레잉 솔루션

## 핵심 특징

- 1 시나리오 안에 **여러 AI 캐릭터** 배치 → 학습자가 카드 선택 → 1:1 롤플레잉
- 같은 시나리오를 다른 캐릭터로 반복 도전 가능 → **360도 시각 학습**
- 기존 AI CANVAS와 별도 신규 솔루션 (인프라·코드 분리)

## 기술 스택

- Node.js + Express
- 바닐라 HTML/CSS/JS
- RDS MySQL (서울 ap-northeast-2)
- AWS Bedrock Claude Sonnet 4.6 (도쿄 ap-northeast-1, Geo JP)
- S3 + CloudFront + Route 53 + ACM
- helmet + express-rate-limit

## 디렉토리 구조

```
multi-persona-roleplay/
├── README.md
├── package.json
├── server.js
├── .env.example
├── public/              ← 정적 파일 (HTML/CSS/JS)
│   ├── index.html
│   ├── character-select.html
│   ├── chat.html
│   ├── report.html
│   ├── admin.html
│   ├── css/
│   └── js/
├── src/                 ← 백엔드 소스
│   ├── routes/
│   ├── services/
│   ├── middleware/
│   └── db/
├── migrations/          ← MySQL 마이그레이션
├── db/                  ← DB 관련 스크립트·시드
├── scenarios/           ← 시나리오·캐릭터 시드 데이터
│   └── samsung-ds-case/
└── docs/                ← 설계 문서
```

## 첫 빌트인 콘텐츠

삼성전자 DS AI센터 그룹장 워크샵 Case Study (2 Case × 상황 3 × 캐릭터 6명)

## 합의서

`../CLAUDE/shared/projects/multi-persona-roleplay/합의서_v1.md` 참조.
