from playwright.sync_api import sync_playwright

BASE = "http://persona.3.39.80.158.nip.io"

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_context().new_page()

    # 페이지 로드
    page.goto(BASE + "/character-select.html?scenario_id=1", timeout=20000)
    page.wait_for_load_state("networkidle")

    # JS에서 fetch로 CSS 직접 요청
    result = page.evaluate("""
        async () => {
            try {
                const r1 = await fetch('/css/design-system.css');
                const r2 = await fetch('/css/character-select.css');
                const t1 = await r1.text();
                return {
                    ds_status: r1.status,
                    cs_status: r2.status,
                    ds_preview: t1.substring(0, 100)
                };
            } catch(e) {
                return { error: e.message };
            }
        }
    """)
    print("CSS fetch 결과:", result)

    browser.close()
