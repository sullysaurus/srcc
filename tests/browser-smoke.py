from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:3100"

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 1000})
    errors = []
    page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
    page.goto(BASE)
    page.wait_for_load_state("networkidle")
    assert page.get_by_role("heading", name="Make the next right move.").is_visible()
    assert page.get_by_text("Foundation preview").is_visible()
    credit = page.get_by_role("link", name="Built by Raleigh AI Guy")
    assert credit.get_attribute("href") == "https://raleighaiguy.com"
    page.screenshot(path="/tmp/southern-revelry-dashboard.png", full_page=True)

    page.get_by_role("link", name="Sales Pipeline").click()
    page.wait_for_load_state("networkidle")
    assert page.get_by_role("heading", name="Every lead, one clear next step.").is_visible()
    page.goto(f"{BASE}/leads/elena-marco")
    page.wait_for_load_state("networkidle")
    assert page.get_by_role("heading", name="Elena Ruiz & Marco Diaz").is_visible()

    mobile = browser.new_page(viewport={"width": 390, "height": 844})
    mobile.goto(BASE)
    mobile.wait_for_load_state("networkidle")
    assert mobile.get_by_role("navigation", name="Mobile").is_visible()
    mobile.screenshot(path="/tmp/southern-revelry-mobile.png", full_page=True)
    assert not errors, f"Browser console errors: {errors}"
    browser.close()

print("browser smoke passed")
