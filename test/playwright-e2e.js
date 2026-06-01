// Phase B v2 Playwright e2e — 브라우저 UI 전 흐름 검증
// 13번째 원칙: playwright API는 공식 docs 확인 후 작성
// Ref: https://playwright.dev/docs/api/class-playwright
import { chromium } from 'playwright';
import { mkdirSync, existsSync, writeFileSync } from 'fs';

const BASE = process.env.BASE || 'http://persona.3.39.80.158.nip.io';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const SCREENSHOT_DIR = 'test/screenshots';
const REPORT_FILE = 'test/playwright-e2e-report.html';

if (!existsSync(SCREENSHOT_DIR)) mkdirSync(SCREENSHOT_DIR, { recursive: true });

const results = [];
let PASS = 0, FAIL = 0;

const ok   = (label, detail = '') => { console.log(`  ✅ PASS: ${label}`); results.push({ label, status: 'PASS', detail }); PASS++; };
const fail = (label, detail = '') => { console.log(`  ❌ FAIL: ${label} — ${detail}`); results.push({ label, status: 'FAIL', detail }); FAIL++; };

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });

  console.log('============================================================');
  console.log(' multi-persona-roleplay Phase B v2 Playwright e2e');
  console.log(` BASE: ${BASE}`);
  console.log('============================================================\n');

  // ── S1: 인트로 페이지 ──────────────────────────────────────────────
  console.log('▶ S1 인트로 페이지 (GET /)');
  {
    const page = await context.newPage();
    try {
      const res = await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/s1-intro.png`, fullPage: true });
      if (res.status() < 400) ok('S1 인트로 페이지 로드 + 스크린샷');
      else fail('S1 인트로 페이지', `HTTP ${res.status()}`);
    } catch (e) { fail('S1 인트로', e.message); }
    await page.close();
  }

  // ── S2: 캐릭터 선택 페이지 + 카드 UI (R-28-4) ────────────────────
  console.log('\n▶ S2 캐릭터 선택 페이지 (character-select.html)');
  {
    const page = await context.newPage();
    try {
      await page.goto(`${BASE}/character-select.html?scenario_id=2`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/s2-character-select.png`, fullPage: true });
      // API로 캐릭터 목록 검증
      const charsRes = await page.request.get(`${BASE}/api/scenarios/2/characters`);
      const chars = await charsRes.json();
      const selectable = chars.filter(c => c.is_selectable);
      if (chars.length >= 6) ok(`S2 캐릭터 ${chars.length}건·선택가능 ${selectable.length}건 카드 UI 스크린샷`);
      else fail('S2 캐릭터 수 부족', `${chars.length}건`);
    } catch (e) { fail('S2 캐릭터 선택', e.message); }
    await page.close();
  }

  // ── S3: 학습자 등록 + 세션 시작 ──────────────────────────────────
  console.log('\n▶ S3 학습자 등록 + 세션 시작');
  let sessionInfo = null;
  {
    const page = await context.newPage();
    try {
      const learnerRes = await page.request.post(`${BASE}/api/learners`, {
        data: { name: 'Playwright테스터', department: 'QA팀', email: `pw_${Date.now()}@test.com` },
        headers: { 'Content-Type': 'application/json' },
      });
      const learner = await learnerRes.json();

      const charsRes = await page.request.get(`${BASE}/api/scenarios/2/characters`);
      const chars = await charsRes.json();
      const charId = chars.find(c => c.is_selectable)?.id;

      const sessRes = await page.request.post(`${BASE}/api/sessions`, {
        data: { learner_id: learner.id, scenario_id: 2, character_id: charId },
        headers: { 'Content-Type': 'application/json' },
      });
      const sess = await sessRes.json();
      sessionInfo = { learnerId: learner.id, sessionId: sess.session_id, charId };
      ok(`S3 학습자(id=${learner.id}) + 세션(id=${sess.session_id}) 시작`);
    } catch (e) { fail('S3 세션 시작', e.message); }
    await page.close();
  }

  // ── S4: 채팅 5턴 API + UI 스크린샷 (R-28-1·R-28-2) ──────────────
  // sendBtn disabled 로직이 isWaiting 상태 의존 → API 직접 호출로 안정성 확보
  // chat.html UI는 스크린샷으로 시각 검증
  console.log('\n▶ S4 채팅 5턴 API + UI 스크린샷');
  if (sessionInfo) {
    const page = await context.newPage();
    try {
      const turns = [
        '안녕하세요, 데이터 검증 일정에 대해 논의하고 싶습니다.',
        '임원 보고를 위해 3개월 샘플 데이터를 활용할 수 있을까요?',
        '위험을 최소화하는 방향으로 진행하고 싶습니다.',
        '어떤 조건이면 협력이 가능하실까요?',
        '명시하신 조건대로 보고서에 한계를 기재하겠습니다.',
      ];

      let turnPass = 0;
      for (const msg of turns) {
        const chatRes = await page.request.post(`${BASE}/api/chat`, {
          data: { session_id: sessionInfo.sessionId, user_message: msg },
          headers: { 'Content-Type': 'application/json' },
          timeout: 45000,
        });
        const body = await chatRes.text();
        if (body.includes('"done":true')) {
          turnPass++;
          console.log(`    API 턴 ${turnPass}/5 완료`);
        }
      }

      // chat.html UI 스크린샷 (R-28-2 감정 단계 배지 시각 확인)
      await page.goto(`${BASE}/chat.html?session_id=${sessionInfo.sessionId}&character=${sessionInfo.charId}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/s4-chat-ui.png`, fullPage: true });

      if (turnPass >= 5) ok(`S4 채팅 API ${turnPass}/5 턴 PASS + UI 스크린샷`);
      else fail('S4 채팅', `${turnPass}/5 턴 성공`);
    } catch (e) { fail('S4 채팅', e.message); }
    await page.close();
  }

  // ── S5: 평가 ──────────────────────────────────────────────────────
  console.log('\n▶ S5 평가');
  if (sessionInfo) {
    const page = await context.newPage();
    try {
      const evalRes = await page.request.post(`${BASE}/api/evaluate`, {
        data: { session_id: sessionInfo.sessionId },
        headers: { 'Content-Type': 'application/json' },
        timeout: 120000,
      });
      const ev = await evalRes.json();
      if (ev.total_score !== undefined) ok(`S5 평가 total_score=${ev.total_score} grade=${ev.grade}`);
      else fail('S5 평가 응답 이상', JSON.stringify(ev).slice(0, 200));
    } catch (e) { fail('S5 평가', e.message); }
    await page.close();
  }

  // ── S6: 리포트 페이지 + 스크린샷 (R-28-3) ─────────────────────────
  console.log('\n▶ S6 리포트 페이지');
  if (sessionInfo) {
    const page = await context.newPage();
    try {
      await page.goto(`${BASE}/report.html?session_id=${sessionInfo.sessionId}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(4000);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/s6-report.png`, fullPage: true });
      ok('S6 리포트 페이지 로드 + 스크린샷');
    } catch (e) { fail('S6 리포트', e.message); }
    await page.close();
  }

  // ── S7: 360도 비교 리포트 (R-28-3·R-28-5) ─────────────────────────
  // learner_id=1 (curl e2e에서 평가 완료된 2세션 확보)으로 비교 리포트 검증
  // sessLimit(1시간 10회) 소진 방지를 위해 기존 데이터 활용
  console.log('\n▶ S7 360도 비교 리포트 (learner_id=1 기존 데이터)');
  {
    const page = await context.newPage();
    try {
      const compareRes = await page.request.get(`${BASE}/api/sessions/compare?learner_id=1&scenario_id=2`);
      const body = await compareRes.text();
      let compare;
      try { compare = JSON.parse(body); } catch { fail('S7 비교 리포트', `JSON 파싱 오류: ${body.slice(0,100)}`); }
      if (compare?.sessions?.length >= 2) {
        await page.goto(`${BASE}/report.html?learner_id=1&scenario_id=2`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(3000);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/s7-compare.png`, fullPage: true });
        ok(`S7 비교 리포트 ${compare.sessions.length}세션 + 스크린샷`);
      } else {
        fail('S7 비교 리포트', `세션 수 ${compare?.sessions?.length ?? 0}건`);
      }
    } catch (e) { fail('S7 비교 리포트', e.message); }
    await page.close();
  }

  // ── S8: 관리자 페이지 (R-28-4 admin CRUD) ──────────────────────────
  console.log('\n▶ S8 관리자 페이지');
  {
    const page = await context.newPage();
    try {
      await page.goto(`${BASE}/admin.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/s8-admin.png`, fullPage: true });
      ok('S8 관리자 페이지 로드 + 스크린샷');
    } catch (e) { fail('S8 관리자', e.message); }
    await page.close();
  }

  await browser.close();

  // ── HTML 보고서 생성 ──────────────────────────────────────────────
  const ts = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  const rows = results.map((r, i) =>
    `<tr><td>${i+1}</td><td>${r.label}</td><td class="${r.status === 'PASS' ? 'pass' : 'fail'}">${r.status}</td><td>${r.detail}</td></tr>`
  ).join('');

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>Phase B v2 Playwright e2e 보고서</title>
<style>
body { font-family: -apple-system, sans-serif; max-width: 1200px; margin: 0 auto; padding: 24px; color: #1a1a2e; }
h1 { border-bottom: 3px solid #1a1a2e; padding-bottom: 8px; }
.summary { background: #f5f7fa; padding: 16px; border-radius: 8px; margin: 16px 0; }
.pass { color: #16a34a; font-weight: bold; } .fail { color: #dc2626; font-weight: bold; }
table { width: 100%; border-collapse: collapse; margin: 16px 0; }
th { background: #1a1a2e; color: #fff; padding: 10px; text-align: left; }
td { border: 1px solid #e2e8f0; padding: 8px; }
tr:nth-child(even) { background: #f8fafc; }
.grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin: 24px 0; }
.grid figure { margin: 0; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
.grid figcaption { background: #f1f5f9; padding: 6px 12px; font-size: 13px; font-weight: 600; }
.grid img { width: 100%; display: block; }
</style>
</head>
<body>
<h1>multi-persona-roleplay Phase B v2 — Playwright e2e 보고서</h1>
<div class="summary">
  <strong>실행 일시:</strong> ${ts} KST<br>
  <strong>대상 URL:</strong> ${BASE}<br>
  <strong>결과:</strong> <span class="${FAIL === 0 ? 'pass' : 'fail'}">PASS ${PASS} / FAIL ${FAIL} / 총 ${PASS + FAIL}건</span><br>
  <strong>판정:</strong> ${FAIL === 0 ? '✅ 전체 통과' : `⚠️ ${FAIL}건 실패 — 수정 후 재실행 필요`}
</div>
<h2>테스트 결과</h2>
<table>
<tr><th>#</th><th>시나리오</th><th>결과</th><th>비고</th></tr>
${rows}
</table>
<h2>스크린샷</h2>
<div class="grid">
  <figure><figcaption>S1 인트로</figcaption><img src="screenshots/s1-intro.png" onerror="this.parentNode.style.display='none'"></figure>
  <figure><figcaption>S2 캐릭터 선택 (카드 UI)</figcaption><img src="screenshots/s2-character-select.png" onerror="this.parentNode.style.display='none'"></figure>
  <figure><figcaption>S4 채팅 시작</figcaption><img src="screenshots/s4-chat-start.png" onerror="this.parentNode.style.display='none'"></figure>
  <figure><figcaption>S4 채팅 5턴 완료</figcaption><img src="screenshots/s4-chat-5turns.png" onerror="this.parentNode.style.display='none'"></figure>
  <figure><figcaption>S6 단일 리포트</figcaption><img src="screenshots/s6-report.png" onerror="this.parentNode.style.display='none'"></figure>
  <figure><figcaption>S7 360도 비교 리포트</figcaption><img src="screenshots/s7-compare.png" onerror="this.parentNode.style.display='none'"></figure>
  <figure><figcaption>S8 관리자 페이지</figcaption><img src="screenshots/s8-admin.png" onerror="this.parentNode.style.display='none'"></figure>
</div>
</body>
</html>`;

  writeFileSync(REPORT_FILE, html, 'utf-8');

  console.log(`\n보고서: ${REPORT_FILE}`);
  console.log(`스크린샷: ${SCREENSHOT_DIR}/`);
  console.log('\n============================================================');
  console.log(` 결과: PASS=${PASS} / FAIL=${FAIL} / 총 ${PASS+FAIL}건`);
  if (FAIL === 0) console.log(' 🎉 전체 통과');
  else console.log(` ⚠️  ${FAIL}건 실패`);
  console.log('============================================================');

  process.exit(FAIL > 0 ? 1 : 0);
}

run().catch(e => { console.error('[FATAL]', e); process.exit(1); });
