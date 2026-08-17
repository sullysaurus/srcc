import os

from playwright.sync_api import sync_playwright

BASE = os.environ.get("BROWSER_TEST_BASE_URL", "http://localhost:3000")
EMAIL = os.environ.get("BROWSER_TEST_EMAIL", "preview@example.com")
PASSWORD = os.environ.get("BROWSER_TEST_PASSWORD", "PreviewPass!2026")

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 1000})
    errors = []
    page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)

    page.goto(f"{BASE}/login")
    page.get_by_label("Email").fill(EMAIL)
    page.get_by_label("Password").fill(PASSWORD)
    page.get_by_role("button", name="Sign in securely").click()
    page.wait_for_timeout(1500)
    assert page.url == BASE + "/", (
        f"Login did not complete (url={page.url}): {page.locator('body').inner_text()}"
    )
    page.wait_for_load_state("networkidle")

    page.goto(BASE)
    page.wait_for_load_state("networkidle")
    assert page.get_by_role("heading", name="Make the next right move.").is_visible()
    assert page.get_by_text("Booked revenue").is_visible()
    assert page.get_by_text("Collected", exact=True).is_visible()
    assert page.get_by_role("region", name="Reporting date range").is_visible()
    page.get_by_role("link", name="7 days", exact=True).click()
    page.wait_for_url("**/?days=7")
    assert "days=7" in page.url
    assert page.get_by_role("columnheader", name="Contacts").is_visible()
    assert page.get_by_role("columnheader", name="Location").is_visible()
    assert page.get_by_text("Amanda Atcheson", exact=True).first.is_visible()
    credit = page.get_by_role("link", name="Built by Afterglow Automations")
    assert credit.get_attribute("href") == "https://afterglowautomations.com"
    page.screenshot(path="/tmp/southern-revelry-dashboard.png", full_page=True)

    page.goto(f"{BASE}/pipeline")
    page.wait_for_load_state("networkidle")
    assert page.get_by_role("heading", name="Every lead, one clear next step.").is_visible()
    assert page.get_by_role("columnheader", name="Contacts").is_visible()
    assert page.get_by_role("columnheader", name="Location").is_visible()
    assert page.get_by_role("columnheader", name="Last contact").is_visible()
    assert page.get_by_role("columnheader", name="Proposal viewed").is_visible()
    assert page.get_by_text("Amanda Atcheson", exact=True).first.is_visible()
    assert page.get_by_text("The Grand Lady", exact=True).is_visible()
    assert page.get_by_text("SMS", exact=True).is_visible()

    page.get_by_label("Search leads").fill("Amanda")
    page.get_by_role("button", name="Apply filters").click()
    page.wait_for_load_state("networkidle")
    assert "q=Amanda" in page.url
    assert page.get_by_text("Showing 1 of 2 leads").is_visible()
    assert page.get_by_text("Jordan Lee", exact=True).count() == 0

    page.locator('nav[aria-label="Saved pipeline views"] a').first.click()
    page.wait_for_load_state("networkidle")
    page.locator('a[href*="sort=dollars"]').click()
    page.wait_for_url("**sort=dollars**")
    page.wait_for_load_state("networkidle")
    assert "sort=dollars" in page.url
    assert "dir=desc" in page.url

    page.locator('a[href*="view=response"]').click()
    page.wait_for_url("**view=response**")
    page.wait_for_load_state("networkidle")
    assert "view=response" in page.url

    page.goto(f"{BASE}/attribution")
    page.wait_for_load_state("networkidle")
    assert page.get_by_role("heading", name="From first click to booked celebration.").is_visible()
    assert page.get_by_text("Website capture is not active yet").is_visible()

    page.goto(f"{BASE}/communications")
    page.wait_for_load_state("networkidle")
    assert page.get_by_role("heading", name="Know when the conversation moved.").is_visible()
    assert page.get_by_text("New SMS from Amanda Atcheson").is_visible()
    assert page.get_by_text("sms", exact=True).is_visible()

    page.goto(f"{BASE}/integrations")
    page.wait_for_load_state("networkidle")
    assert page.get_by_text("Website attribution").is_visible()

    mobile = browser.new_page(viewport={"width": 390, "height": 844})
    mobile.goto(f"{BASE}/login")
    mobile.get_by_label("Email").fill(EMAIL)
    mobile.get_by_label("Password").fill(PASSWORD)
    mobile.get_by_role("button", name="Sign in securely").click()
    mobile.wait_for_timeout(1500)
    assert mobile.url == BASE + "/", (
        f"Mobile login did not complete (url={mobile.url}): {mobile.locator('body').inner_text()}"
    )
    mobile.goto(BASE)
    mobile.wait_for_load_state("networkidle")
    assert mobile.get_by_role("navigation", name="Mobile").is_visible()
    mobile.screenshot(path="/tmp/southern-revelry-mobile.png", full_page=True)
    assert not errors, f"Browser console errors: {errors}"
    browser.close()

print("browser smoke passed")
