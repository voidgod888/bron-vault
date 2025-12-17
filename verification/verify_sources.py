from playwright.sync_api import sync_playwright, expect

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            # Navigate to sources page
            # Assuming Next.js runs on 3000
            page.goto("http://localhost:3000/dashboard/sources")

            # Wait for content or timeout (since DB is down, it might show error)
            # We expect to see "Data Sources" heading
            try:
                page.wait_for_selector("h1:has-text('Data Sources')", timeout=10000)
            except:
                print("Heading not found, page might be erroring due to DB")

            # Take screenshot of whatever we have
            page.screenshot(path="verification/sources_page.png", full_page=True)
            print("Screenshot taken")

        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    run()
