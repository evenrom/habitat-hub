const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Construct absolute file path to index.html
  const filePath = `file://${path.resolve('frontend/index.html')}`;
  console.log(`Navigating to: ${filePath}`);

  // Intercept the API call BEFORE navigation
  await page.route('**/*', async route => {
    const request = route.request();
    if (request.url().includes('script.google.com') && request.method() === 'POST') {
      const postData = JSON.parse(request.postData());

      if (postData.action === 'getInitialData') {
        console.log('Mocking getInitialData');
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            rooms: ['Living Room', 'Kitchen', 'Bedroom'],
            items: [
              {
                ID: '1', Room: 'Living Room', Type: 'Main', Name: 'Sofa', Price: 5000,
                Dim_L: '200', Dim_W: '90', Dim_H: '80', ImageID: '', ProductURL: ''
              },
              {
                ID: '2', Room: 'Living Room', Type: 'Alternative', ParentID: '1', Name: 'Sofa Option 2', Price: 4500,
                Dim_L: '190', Dim_W: '85', Dim_H: '80', ImageID: '', ProductURL: ''
              }
            ]
          })
        });
        return;
      }
    }
    await route.continue();
  });

  await page.goto(filePath);

  // Wait for room list to appear (mock data loaded)
  try {
    await page.waitForSelector('.room-card', { timeout: 5000 });
    console.log('Room cards found');
  } catch (e) {
    console.log('Room cards not found within timeout');
    await page.screenshot({ path: 'frontend_verification/error_state.png' });
  }

  // Take screenshot of Rooms View
  await page.screenshot({ path: 'frontend_verification/rooms_view.png' });
  console.log('Screenshot saved: frontend_verification/rooms_view.png');

  // Click on "Living Room"
  const roomCard = await page.$('text=Living Room');
  if (roomCard) {
    await roomCard.click();
    console.log('Clicked Living Room');

    // Wait for details
    await page.waitForSelector('.item-card');

    // Open Accordion
    const accordionHeader = await page.$('.accordion-header');
    if (accordionHeader) {
      await accordionHeader.click();
      await page.waitForTimeout(500); // Animation
    }

    // Take screenshot of Room Detail View
    await page.screenshot({ path: 'frontend_verification/room_detail_view.png' });
    console.log('Screenshot saved: frontend_verification/room_detail_view.png');
  }

  // Switch to Budget View
  const budgetBtn = await page.$('[data-target="view-budget"]');
  if (budgetBtn) {
    await budgetBtn.click();
    await page.waitForTimeout(500);

    // Take screenshot of Budget View
    await page.screenshot({ path: 'frontend_verification/budget_view.png' });
    console.log('Screenshot saved: frontend_verification/budget_view.png');
  }

  await browser.close();
})();
