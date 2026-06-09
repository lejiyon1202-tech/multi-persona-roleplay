from playwright.sync_api import sync_playwright

BASE = "http://persona.3.39.80.158.nip.io"

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_context().new_page()

    all_responses = []
    page.on("response", lambda r: all_responses.append((r.status, r.url)))

    page.goto(BASE + "/character-select.html?scenario_id=1", timeout=20000)
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)

    print("=== 모든 네트워크 응답 ===")
    for status, url in all_responses:
        print(f"  {status}: {url}")

    # character-select.html 소스 확인
    html_content = page.content()
    import re
    links = re.findall(r'<link[^>]+href="([^"]+)"', html_content)
    print("\n=== HTML link 태그 ===")
    for l in links:
        print(f"  {l}")

    browser.close()
