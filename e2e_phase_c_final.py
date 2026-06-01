"""
통합 e2e — Phase B(8) + Phase C(S9~S12) = 12 시나리오
실 서버: https://persona.3.39.80.158.nip.io
Phase B: 5페이지 UI 기능 체크 (index/charselect/chat/report/admin)
Phase C: 시나리오 B (id=4) 캐릭터별 선택 흐름 × 4 (S9~S12)
"""
from playwright.sync_api import sync_playwright
import os, sys, io
from datetime import datetime

# Windows cp949 콘솔 UTF-8 강제 (em dash 등 유니코드 인코딩 오류 방지)
if sys.stdout.encoding and sys.stdout.encoding.lower() not in ('utf-8', 'utf8'):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
if sys.stderr.encoding and sys.stderr.encoding.lower() not in ('utf-8', 'utf8'):
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

BASE = "https://persona.3.39.80.158.nip.io"
OUT  = r"C:\Users\lejiyon\Desktop\multi-persona-roleplay"

results = []
console_errors_all = []

def ok(tag, msg):
    results.append({"tag": tag, "status": "PASS", "msg": msg})
    print(f"PASS [{tag}] {msg}")

def fail(tag, msg):
    results.append({"tag": tag, "status": "FAIL", "msg": msg})
    print(f"FAIL [{tag}] {msg}")

def safe_screenshot(page, path, **kwargs):
    try:
        page.screenshot(path=path, **kwargs)
        return True
    except Exception as e:
        print(f"  [screenshot 실패] {e}")
        return False

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(ignore_https_errors=True)
    page = ctx.new_page()
    page.on("console", lambda m: console_errors_all.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: console_errors_all.append(str(e)))

    # ══════════════════════════════════════════════════════════════
    # PHASE B — 5페이지 실 서버 UI 기능 체크 (B-1 ~ B-8)
    # ══════════════════════════════════════════════════════════════

    # B-1: index.html — 시나리오 카드 로드
    try:
        page.set_viewport_size({"width": 1280, "height": 720})
        page.goto(f"{BASE}/", timeout=20000)
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(2500)
        cards = page.locator(".scenario-card").count()
        ok("B-1", f"시나리오 카드 로드: {cards}개") if cards >= 3 else fail("B-1", f"시나리오 카드 {cards}개 (기대 3)")
        safe_screenshot(page, os.path.join(OUT, "e2e_c_index.png"))
        ok("B-1", "index.html 스크린샷")
    except Exception as e:
        fail("B-1", f"index.html 오류: {e}")

    # B-2: index.html — data-theme 속성 + inline 요소 0건
    try:
        theme_attr = page.evaluate("document.documentElement.getAttribute('data-theme')")
        ok("B-2", f"data-theme 속성 존재: {theme_attr}") if theme_attr else fail("B-2", "data-theme 속성 없음")
        inline_style  = page.evaluate("document.querySelectorAll('style:not([data-vite])').length")
        inline_script = page.evaluate("document.querySelectorAll('script:not([src])').length")
        ok("B-2", f"inline <style> 0건: {inline_style}건") if inline_style == 0 else fail("B-2", f"inline style {inline_style}건 잔존")
        ok("B-2", f"inline <script> 0건: {inline_script}건") if inline_script == 0 else fail("B-2", f"inline script {inline_script}건 잔존")
    except Exception as e:
        fail("B-2", f"테마/inline 확인 오류: {e}")

    # B-3: index.html — 모바일 반응형
    try:
        page.set_viewport_size({"width": 375, "height": 812})
        page.wait_for_timeout(300)
        safe_screenshot(page, os.path.join(OUT, "e2e_c_index_mobile.png"))
        ok("B-3", "index.html 모바일(375px) 스크린샷")
        page.set_viewport_size({"width": 1280, "height": 720})
    except Exception as e:
        fail("B-3", f"모바일 반응형 오류: {e}")

    # B-4: character-select.html (시나리오 1) — 카드 렌더링
    try:
        page.goto(f"{BASE}/character-select.html?scenario_id=1", timeout=20000)
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(2000)
        char_cards = page.locator(".char-card").count()
        selectable = page.locator(".char-card.selectable").count()
        ctx_only   = page.locator(".char-card.context-only").count()
        ok("B-4", f"Case 1 캐릭터 카드 {char_cards}개 (선택 가능 {selectable} / 컨텍스트 {ctx_only})") if char_cards >= 6 else fail("B-4", f"캐릭터 카드 {char_cards}개 (기대 6)")
        safe_screenshot(page, os.path.join(OUT, "e2e_c_charselect_case1.png"))
        ok("B-4", "character-select.html Case 1 스크린샷")
    except Exception as e:
        fail("B-4", f"character-select 오류: {e}")

    # B-5: chat.html — 기본 UI
    try:
        page.goto(f"{BASE}/chat.html?scenario_id=1&character=3", timeout=20000)
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1000)
        header = page.locator(".chat-header").count()
        aria_input = page.locator("[aria-label='메시지 입력']").count()
        ok("B-5", f"chat.html 헤더 + 입력창: header={header} input={aria_input}") if header > 0 and aria_input > 0 else fail("B-5", f"chat.html 기본 UI 오류: header={header} input={aria_input}")
        safe_screenshot(page, os.path.join(OUT, "e2e_c_chat.png"))
        ok("B-5", "chat.html 스크린샷")
    except Exception as e:
        fail("B-5", f"chat.html 오류: {e}")

    # B-6: report.html
    try:
        page.goto(f"{BASE}/report.html?session_id=1", timeout=20000)
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1000)
        tabs = page.locator(".report-tab").count()
        ok("B-6", f"report.html 탭 {tabs}개") if tabs == 2 else fail("B-6", f"report.html 탭 {tabs}개 (기대 2)")
        safe_screenshot(page, os.path.join(OUT, "e2e_c_report.png"), full_page=True)
        ok("B-6", "report.html 스크린샷")
    except Exception as e:
        fail("B-6", f"report.html 오류: {e}")

    # B-7: admin.html — 인증 오버레이
    try:
        page.goto(f"{BASE}/admin.html", timeout=20000)
        page.wait_for_load_state("networkidle")
        auth = page.locator("#authOverlay").count()
        pwd  = page.locator("input[type='password']").count()
        ok("B-7", f"admin.html 인증 오버레이: auth={auth} pwd={pwd}") if auth > 0 else fail("B-7", "admin.html 인증 오버레이 없음")
        safe_screenshot(page, os.path.join(OUT, "e2e_c_admin.png"))
        ok("B-7", "admin.html 스크린샷")
    except Exception as e:
        fail("B-7", f"admin.html 오류: {e}")

    # B-8: CSP 헤더 + 콘솔 에러 0건
    try:
        resp = page.goto(f"{BASE}/", timeout=20000)
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1500)
        csp = resp.headers.get("content-security-policy", "")
        ok("B-8", f"CSP 헤더 존재: {csp[:60]}...") if csp else fail("B-8", "CSP 헤더 없음")
        csp_errors = [e for e in console_errors_all if "Content Security Policy" in e]
        ok("B-8", f"CSP 차단 에러 0건: {len(csp_errors)}건") if len(csp_errors) == 0 else fail("B-8", f"CSP 에러 {len(csp_errors)}건")
        total_errs = len(console_errors_all)
        ok("B-8", f"총 콘솔 에러: {total_errs}건") if total_errs == 0 else fail("B-8", f"콘솔 에러 {total_errs}건: {console_errors_all[:3]}")
    except Exception as e:
        fail("B-8", f"CSP/콘솔 에러 확인 오류: {e}")

    # ══════════════════════════════════════════════════════════════
    # PHASE C — 시나리오 B (id=4) 캐릭터별 선택 흐름 (S9 ~ S12)
    # ══════════════════════════════════════════════════════════════

    # S9: 시나리오 B 캐릭터 선택 페이지 공통 확인
    try:
        page.goto(f"{BASE}/character-select.html?scenario_id=4", timeout=20000)
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(2000)

        sc_label = ""
        try:
            sc_label = page.locator("#scenarioLabel").inner_text(timeout=3000)
        except Exception:
            pass
        ok("S9", f"시나리오 B 헤더: '{sc_label[:40]}'") if sc_label else fail("S9", "시나리오 B 헤더 없음 (#scenarioLabel)")

        b_char_cards = page.locator(".char-card").count()
        b_selectable = page.locator(".char-card.selectable").count()
        b_ctx_only   = page.locator(".char-card.context-only").count()
        ok("S9", f"시나리오 B 캐릭터 {b_char_cards}개 (선택 가능 {b_selectable} / 컨텍스트 {b_ctx_only})") if b_char_cards == 6 and b_selectable == 4 else fail("S9", f"캐릭터 카드 오류: total={b_char_cards} selectable={b_selectable}")
        safe_screenshot(page, os.path.join(OUT, "e2e_c_charselect_case3.png"))
        ok("S9", "시나리오 B character-select 스크린샷")
    except Exception as e:
        fail("S9", f"시나리오 B 캐릭터 선택 오류: {e}")

    # S9~S12: 각 캐릭터 chat 진입
    for snum, card_num, char_name in [("S9", 3, "강민경"), ("S10", 4, "박기훈"), ("S11", 5, "윤서준"), ("S12", 6, "이동현")]:
        try:
            page.goto(f"{BASE}/chat.html?scenario_id=4&character={card_num}", timeout=20000)
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(1000)

            hdr = page.locator(".chat-header").count()
            inp = page.locator("[aria-label='메시지 입력']").count()
            ok(snum, f"Card {card_num} ({char_name}) chat 진입: header={hdr} input={inp}") if hdr > 0 and inp > 0 else fail(snum, f"Card {card_num} chat 진입 실패: header={hdr} input={inp}")
            safe_screenshot(page, os.path.join(OUT, f"e2e_c_chat_{snum}_{char_name}.png"))
            ok(snum, f"Card {card_num} ({char_name}) chat 스크린샷")
        except Exception as e:
            fail(snum, f"Card {card_num} ({char_name}) 오류: {e}")

    browser.close()

# ══════════════════════════════════════════════════════════════════
# 결과 집계 + HTML 보고서 생성
# ══════════════════════════════════════════════════════════════════
pass_cnt = sum(1 for r in results if r["status"] == "PASS")
fail_cnt = sum(1 for r in results if r["status"] == "FAIL")
total    = len(results)
score_pct = round(pass_cnt / total * 100, 1) if total > 0 else 0

print("\n" + "="*60)
print("통합 e2e Phase B(8) + Phase C(S9~S12) 결과")
print("="*60)
print(f"PASS: {pass_cnt} / FAIL: {fail_cnt} / 총: {total} ({score_pct}%)")
for r in results:
    print(f"{'PASS' if r['status']=='PASS' else 'FAIL'} [{r['tag']}] {r['msg']}")

rows = ""
for r in results:
    color = "#2d6a4f" if r["status"] == "PASS" else "#c1121f"
    rows += f'<tr><td style="color:{color};font-weight:bold">{r["status"]}</td><td>[{r["tag"]}]</td><td>{r["msg"]}</td></tr>\n'

html = f"""<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8">
<title>통합 e2e — Phase B·C 결과</title>
<style>
body{{font-family:'Noto Sans KR',sans-serif;max-width:900px;margin:40px auto;padding:0 20px;background:#f8f9fa}}
h1{{font-size:1.4rem;color:#212529}}
.summary{{display:flex;gap:16px;margin:16px 0}}
.badge{{padding:8px 20px;border-radius:8px;font-weight:700;font-size:1.1rem}}
.pass{{background:#d8f3dc;color:#1b4332}}
.fail{{background:#ffe8e8;color:#c1121f}}
.score{{background:#e3f2fd;color:#1565c0}}
table{{width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.1)}}
th{{background:#343a40;color:#fff;padding:10px 12px;text-align:left;font-size:.85rem}}
td{{padding:8px 12px;border-bottom:1px solid #dee2e6;font-size:.85rem}}
</style></head><body>
<h1>통합 e2e 결과 — Phase B(8) + Phase C(S9~S12)</h1>
<p style="color:#6c757d;font-size:.85rem">실행: {datetime.now().strftime('%Y-%m-%d %H:%M KST')} | 서버: {BASE}</p>
<div class="summary">
  <span class="badge pass">PASS {pass_cnt}</span>
  <span class="badge fail">FAIL {fail_cnt}</span>
  <span class="badge score">총 {total}건 {score_pct}%</span>
</div>
<table><thead><tr><th>결과</th><th>태그</th><th>내용</th></tr></thead><tbody>
{rows}
</tbody></table>
</body></html>"""

report_path = os.path.join(OUT, "e2e_phase_c_report.html")
with open(report_path, "w", encoding="utf-8") as f:
    f.write(html)
print(f"\nHTML 보고서: {report_path}")

if fail_cnt > 0:
    sys.exit(1)
