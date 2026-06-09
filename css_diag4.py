from playwright.sync_api import sync_playwright
import os

BASE = "http://persona.3.39.80.158.nip.io"
OUT  = r"C:\Users\lejiyon\Desktop\multi-persona-roleplay"

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_context(
        ignore_https_errors=True,
        # 캐시 비활성화로 실제 요청 강제
        extra_http_headers={"Cache-Control": "no-cache"}
    ).new_page()

    all_req = []
    page.on("requestfinished", lambda r: all_req.append((r.url, r.response().status() if r.response() else 0)))
    page.on("requestfailed", lambda r: all_req.append((r.url, "FAILED")))

    page.goto(BASE + "/character-select.html?scenario_id=1", timeout=20000)
    page.wait_for_selector(".char-card", timeout=10000)
    page.wait_for_timeout(3000)

    print("=== 모든 완료된 요청 ===")
    for url, status in all_req:
        if "persona" in url or "cdn." in url:
            print(f"  {status}: {url}")

    # CSS 변수 최종 확인
    bg = page.evaluate("window.getComputedStyle(document.body).background")
    role = page.evaluate("window.getComputedStyle(document.documentElement).getPropertyValue('--role-lead')")
    print(f"\nbody.background: [{bg[:50]}]")
    print(f"--role-lead: [{role}]")

    # 스크린샷 (전체 대기 후)
    page.screenshot(path=os.path.join(OUT, "css_diag_charselect.png"), full_page=False)
    print("스크린샷 저장")

    browser.close()
