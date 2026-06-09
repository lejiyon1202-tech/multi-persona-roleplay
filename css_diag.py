from playwright.sync_api import sync_playwright

BASE = "http://persona.3.39.80.158.nip.io"

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_context().new_page()

    css_responses = []
    page.on("response", lambda r: css_responses.append((r.url, r.status)) if ".css" in r.url else None)

    page.goto(BASE + "/character-select.html?scenario_id=1", timeout=20000)
    page.wait_for_selector(".char-card", timeout=8000)
    page.wait_for_timeout(3000)

    for url, status in css_responses:
        print(f"CSS {status}: {url}")

    v1 = page.evaluate("window.getComputedStyle(document.documentElement).getPropertyValue('--role-lead').trim()")
    v2 = page.evaluate("window.getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()")
    v3 = page.evaluate("document.documentElement.dataset.theme")
    v4 = page.evaluate("window.getComputedStyle(document.body).backgroundColor")
    v5 = page.evaluate("document.body.style.background")
    print(f"--role-lead: [{v1}]")
    print(f"--bg: [{v2}]")
    print(f"data-theme: [{v3}]")
    print(f"body.bg (computed): [{v4}]")
    print(f"body.bg (inline): [{v5}]")

    browser.close()
