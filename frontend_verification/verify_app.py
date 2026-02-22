import json
from playwright.sync_api import sync_playwright
import os

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()

    # Get absolute path to index.html
    cwd = os.getcwd()
    file_path = f"file://{cwd}/frontend/index.html"

    print(f"Navigating to {file_path}")

    # Intercept API calls to mock backend
    def handle_route(route):
        request = route.request
        if "script.google.com" in request.url and request.method == "POST":
            # Check payload action
            try:
                post_data = json.loads(request.post_data)
                if post_data.get("action") == "getInitialData":
                    print("Mocking getInitialData")
                    route.fulfill(
                        status=200,
                        content_type="application/json",
                        body=json.dumps({
                            "rooms": ["Living Room", "Kitchen", "Bedroom"],
                            "items": [
                                { "ID": "1", "Room": "Living Room", "Type": "Main", "Name": "Sofa", "Price": 5000, "Dim_L": "200", "Dim_W": "90", "Dim_H": "80", "ImageID": "", "ProductURL": "" },
                                { "ID": "2", "Room": "Living Room", "Type": "Alternative", "ParentID": "1", "Name": "Sofa Option 2", "Price": 4500, "Dim_L": "190", "Dim_W": "85", "Dim_H": "80", "ImageID": "", "ProductURL": "" }
                            ]
                        })
                    )
                    return
            except Exception as e:
                print(f"Error parsing post data: {e}")

        # Continue other requests
        route.continue_()

    page.route("**/*", handle_route)

    page.goto(file_path)

    # 1. Verify Room List Rendered
    try:
        page.wait_for_selector(".room-card", timeout=5000)
        print("Room cards found.")
    except:
        print("Room cards NOT found. Saving error screenshot.")
        page.screenshot(path="frontend_verification/error_rooms.png")

    page.screenshot(path="frontend_verification/rooms_view.png")

    # 2. Click Room and Verify Detail
    page.click("text=Living Room")

    try:
        page.wait_for_selector(".item-card", timeout=2000)
        print("Item cards found.")
        # Expand Accordion
        page.click(".accordion-header")
        page.wait_for_timeout(500)
        page.screenshot(path="frontend_verification/room_detail_view.png")
    except:
         print("Item cards NOT found.")

    # 3. Verify Budget View
    page.click("[data-target='view-budget']")
    page.wait_for_timeout(500)
    page.screenshot(path="frontend_verification/budget_view.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
