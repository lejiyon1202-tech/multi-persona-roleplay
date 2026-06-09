# 합의서 Phase C — UI 사양 (기안84 담당)

작성일: 2026-06-02 KST
담당: 기안84

---

## Phase C 기안84 작업 범위

| # | 작업 | 내용 | 우선순위 |
|---|------|------|--------|
| C-1 | HTTPS 전환 후 UI 정합성 재검증 | SSL 도입 후 모든 5페이지 CSP 에러 0건 재확인 | 높음 |
| C-2 | index.html 시나리오 카드 타임아웃 수정 | waitForSelector 방식으로 API 응답 대기 보강 | 높음 |
| C-3 | 신규 시나리오 2~3건 UI 대응 | 시나리오 카드 + 캐릭터 카드 범용 대응 확인 | 중간 |
| C-4 | character-select.html → API 연동 | 현재 정적 하드코딩 → `/api/scenarios/:id/characters` 연동 | 중간 |
| C-5 | 운영 모니터링 알림 UI | 게이트 12 — CloudWatch/pm2 에러 발생 시 관리자 페이지 표시 | 낮음 |

---

## C-1. HTTPS 전환 후 UI 정합성 재검증

**배경:** Phase B에서 `upgradeInsecureRequests: null` B안으로 임시 처리. Phase C에서 HTTPS 정식 전환 후 CSP 원래 설정 복원 필요.

**검증 항목:**
```
[ ] SSL/HTTPS 전환 완료 후 5페이지 전수 CSS 로드 확인
[ ] CSP upgrade-insecure-requests 복원 후 콘솔 에러 0건
[ ] cdn.jsdelivr.net HTTPS 요청 정상 (이미 https:// 링크)
[ ] Playwright e2e 8/8 PASS (S10 SSL/HTTPS 게이트 신규 포함)
```

**CSS 변수 확인 기준:**
- `--role-lead`: `#134e4a`
- `--bg`: `#f0f2f8`
- `body.backgroundColor`: `rgb(240, 242, 248)`

---

## C-2. index.html 시나리오 카드 타임아웃 수정

**현재 문제:** `/api/scenarios` 응답 후 JS 비동기 렌더링 완료 전에 Playwright가 카드 존재 체크.

**수정 방법 (scenario-select.js):**
```js
// 현재: loadScenarios() 후 렌더만
// 수정: waitForSelector 기반 대기 또는 렌더 완료 콜백 보장

async function loadScenarios() {
  const grid = document.getElementById('scenarioGrid');
  // 로딩 스피너 표시
  grid.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
  try {
    const res = await fetch('/api/scenarios');
    const data = await res.json();
    if (!data.scenarios || !data.scenarios.length) {
      grid.innerHTML = `<div class="empty-state grid-span-full">...</div>`;
      return;
    }
    grid.innerHTML = data.scenarios.map(renderScenarioCard).join('');
    bindScenarioEvents();
    // 카드 렌더 완료 이벤트 발생
    grid.dispatchEvent(new Event('scenariosLoaded'));
  } catch { ... }
}
```
- Playwright e2e에서 `page.wait_for_selector('.scenario-card')` 명시 대기

---

## C-3. 신규 시나리오 2~3건 UI 대응

**현재 상태:** character-select.html은 Case 1 하드코딩된 6명 카드.

**Phase C 목표:** DB에서 캐릭터 데이터를 동적으로 로드하는 방식으로 전환.

**수정 방법 (character-select.js):**
```js
// URL 파라미터 scenario_id 기반으로 API 호출
async function loadCharacters() {
  const scenarioId = new URLSearchParams(location.search).get('scenario_id');
  if (!scenarioId) { ... }
  const res = await fetch(`/api/scenarios/${scenarioId}/characters`);
  const data = await res.json();
  renderCharacterCards(data.characters);
}

function renderCharacterCards(characters) {
  const grid = document.querySelector('.card-grid');
  grid.innerHTML = characters.map(c => buildCardHTML(c)).join('');
  bindCardEvents();
}
```

**`buildCardHTML(char)` 함수:**
```
→ 역할 뱃지 (ROLE_KEY 맵 기반)
→ 카드 번호 (card_number 필드)
→ 이름 + 직책 (name, department)
→ 핵심 마인드 (core_mindset)
→ 상황·감정 + 미션 (situation, mission)
→ is_selectable 기반 활성/비활성 처리
```

**삭제 대상:** 현재 character-select.html의 하드코딩 6카드 HTML → JS 동적 생성으로 교체

---

## C-4. character-select.html 정적→동적 전환 작업 계획

| 단계 | 작업 |
|------|------|
| 1 | character-select.html에서 카드 HTML 6개 제거 |
| 2 | character-select.js에 `loadCharacters()` 함수 추가 |
| 3 | `buildCardHTML(char)` 함수 구현 |
| 4 | 빈 상태 (API 실패 시 데모 폴백) 처리 |
| 5 | Playwright e2e S2 재검증 |

---

## C-5. 관리자 페이지 운영 모니터링 UI (낮음)

**Phase C 운영 인프라 분리 완료 후** CloudWatch 알림을 관리자 대시보드에 표시.

**admin.html 통계 섹션 보강:**
```js
// GET /api/admin/stats → 서버 상태·에러 카운트 추가
{
  total_sessions: N,
  total_evals: N,
  avg_score: N,
  // Phase C 신규:
  server_uptime: "N days",
  last_error: "2026-06-01 오류 메시지",
  error_count_24h: N
}
```

---

## Phase C 기안84 산출물 목록

| # | 파일 | 내용 | ETA |
|---|------|------|------|
| 1 | `public/character-select.html` (v3) | 하드코딩 카드 → JS 동적 생성 전환 | Phase C 착수 후 |
| 2 | `public/js/character-select.js` | `loadCharacters()` + `buildCardHTML()` 추가 | Phase C 착수 후 |
| 3 | `public/js/scenario-select.js` | API 응답 후 렌더 완료 이벤트 보강 | Phase C 착수 후 |
| 4 | `public/admin.html` (통계 보강) | 서버 상태 표시 | Phase C 운영 인프라 후 |

---

## C 체크리스트 적용 (Phase C)

모든 신규/수정 HTML 납품 전 10항 전수 확인 의무. 특히:
- 동적 생성 카드 HTML에서 `font-size ≥ 16px` 유지
- `buildCardHTML()` 에서 WCAG AA 대비 확인
- 외부 기업명 동적 렌더링에도 포함 금지 (게이트 8 확장)

---

## Phase C 기안84 체감 검증 의무

1. HTTPS 전환 후 Ctrl+Shift+R 강제 새로고침 → CSS 변수 확인
2. 신규 시나리오 카드 최소 2건 시각 확인 (다른 역할 색상 조합)
3. character-select.html 동적 로드 → 카드 6개 정상 표시 확인
4. Playwright e2e S2 (캐릭터 카드) + S10 (SSL) 통과 확인
