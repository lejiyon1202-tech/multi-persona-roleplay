"""
chat.html API 연동 재검증 — /api/scenarios/:id/characters/:charId
"""
from playwright.sync_api import sync_playwright
import os

BASE = "https://persona.3.39.80.158.nip.io"
OUT  = r"C:\Users\lejiyon\Desktop\multi-persona-roleplay"
results = []
console_errors = []
api_404s = []

def ok(m):   results.append(("PASS", m)); print(f"PASS {m}")
def fail(m): results.append(("FAIL", m)); print(f"FAIL {m}")

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(ignore_https_errors=True)
    page = ctx.new_page()
    page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
    page.on("response", lambda r: api_404s.append(r.url) if r.status == 404 else None)

    # Case 3 시나리오 B에서 캐릭터 선택 후 채팅 진입 시뮬레이션
    # character id는 시나리오 B에서 is_selectable=true인 캐릭터 (id 구하기)
    page.goto(f"{BASE}/character-select.html?scenario_id=4", timeout=20000)
    page.wait_for_selector(".char-card.selectable", timeout=10000)
    page.wait_for_timeout(500)

    # 첫 번째 선택 가능 카드의 char-number 가져오기
    char_number = page.evaluate("""
        () => document.querySelector('.char-card.selectable')?.dataset?.number
    """)
    ok(f"시나리오 B 첫 선택 가능 카드 번호: {char_number}") if char_number else fail("선택 가능 카드 없음")

    # char-number로 API 직접 확인
    # scenario_id=4, character number로 character_id 찾기
    char_id_result = page.evaluate("""
        async () => {
            try {
                const r = await fetch('/api/scenarios/4/characters');
                const data = await r.json();
                const chars = data.characters || data;
                const selectable = chars.filter(c => c.is_selectable);
                return selectable.length > 0 ? selectable[0].id : null;
            } catch(e) { return null; }
        }
    """)
    ok(f"선택 가능 첫 캐릭터 id: {char_id_result}") if char_id_result else fail("캐릭터 id 조회 실패")

    # chat.html 접속 (실제 character id와 scenario_id 포함)
    if char_id_result:
        page.goto(f"{BASE}/chat.html?character={char_id_result}&scenario_id=4", timeout=20000)
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(2000)

        # chat 헤더 로드 확인
        mini_name = page.evaluate("document.getElementById('miniName')?.textContent")
        ok(f"chat.html 캐릭터 로드: {mini_name}") if mini_name and mini_name != "로딩 중..." else fail(f"캐릭터 로드 실패: {mini_name}")

        # 404 에러 없음 확인
        chat_404s = [u for u in api_404s if "characters" in u or "character" in u]
        ok(f"캐릭터 API 404 에러 0건: {len(chat_404s)}건") if len(chat_404s) == 0 else fail(f"캐릭터 API 404: {chat_404s}")

        page.screenshot(path=os.path.join(OUT, "sc_b_chat.png"))
        ok("chat.html (시나리오 B) 스크린샷")

    # 전체 콘솔 에러 확인
    critical_errors = [e for e in console_errors if "404" in e or "Failed to fetch" in e or "undefined" in e.lower()]
    ok(f"치명 에러 0건: {len(critical_errors)}건") if len(critical_errors) == 0 else fail(f"치명 에러 {len(critical_errors)}건: {critical_errors[:2]}")

    browser.close()

print()
pass_cnt = sum(1 for r, _ in results if r == "PASS")
fail_cnt = sum(1 for r, _ in results if r == "FAIL")
print(f"PASS:{pass_cnt} FAIL:{fail_cnt}")
