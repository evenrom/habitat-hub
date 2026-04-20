const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  page.on('pageerror', err => {
    errors.push(err.message);
  });

  await page.route('**/exec*', async route => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
      return;
    }

    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          renders: [
             { node_id: "test_node", title: "Living Room View", drive_image_id: "fake_id" }
          ],
          items: [],
          config: {}
        })
      });
      return;
    }
    await route.continue();
  });

  // Mock SVG to include an overlapping node over a room hitbox
  await page.route('**/assets/floorplan.svg', async route => {
      await route.fulfill({
          status: 200,
          contentType: 'image/svg+xml',
          body: `<svg viewBox="0 0 100 100">
                   <rect class="room-hitbox" data-room-id="Living Room" x="0" y="0" width="100" height="100" fill="blue" />
                   <circle class="render-node" id="test_node" cx="50" cy="50" r="10" fill="red" />
                 </svg>`
      });
  });

  console.log('Navigating to http://localhost:8080/index.html...');
  await page.goto('http://localhost:8080/index.html', { waitUntil: 'networkidle' });

  try {
    await page.waitForTimeout(1000);

    // Re-bind modules dynamically for testing
    await page.evaluate(() => {
       if (typeof window.UI === 'undefined') {
          import('./js/ui.js').then(module => window.UI = module.UI);
       }
       if (typeof window.Store === 'undefined') {
          import('./js/store.js').then(module => window.Store = module.Store);
       }
    });
    await page.waitForTimeout(500);

    // Track if Room Select was fired
    await page.evaluate(() => {
       window.roomSelected = false;
       // Mock Store render data so events resolve accurately
       window.Store.setState({ renders: [{ node_id: "test_node", title: "Living Room View", drive_image_id: "fake_id" }] });

       window.UI.initMapEvents((roomId) => { window.roomSelected = roomId; });
    });

    // Test overlapping click directly dispatching targeting the exact node element
    // because Playwright generic mouse.click(x,y) on scaling SVGs can miss bounding boxes
    await page.evaluate(() => {
        const node = document.getElementById('test_node');
        const event = new MouseEvent('click', { bubbles: true, cancelable: true });
        node.dispatchEvent(event);
    });

    await page.waitForTimeout(500);

    // Check Modal Visibility
    const isModalVisibleAndHasCorrectSrc = await page.evaluate(() => {
       const modal = document.getElementById('render-modal');
       if (!modal || modal.classList.contains('hidden')) return false;
       const img = document.getElementById('render-modal-img');
       return img.src.includes('drive.google.com/thumbnail?id=fake_id&sz=w1600');
    });
    console.log('Modal visible and mapped:', isModalVisibleAndHasCorrectSrc);
    if (!isModalVisibleAndHasCorrectSrc) throw new Error('Modal did not open on node click');

    // Check Room Hitbox was NOT fired
    const roomSelectedState = await page.evaluate(() => window.roomSelected);
    console.log('Underlying Room Selected:', roomSelectedState);
    if (roomSelectedState) throw new Error('Event propagated to underlying room hitbox!');

    // Ignore Favicon errors
    const filteredErrors = errors.filter(e => !e.includes('favicon.ico') && !e.includes('ERR_CONNECTION_CLOSED'));

    if (filteredErrors.length > 0) {
      console.error('Errors found:', filteredErrors);
      process.exit(1);
    } else {
      console.log('No relevant console errors found. Tests passed.');
      process.exit(0);
    }
  } catch (e) {
    console.error('Test failed:', e.message);
    const filteredErrors = errors.filter(e => !e.includes('favicon.ico') && !e.includes('ERR_CONNECTION_CLOSED'));
    if (filteredErrors.length > 0) console.error('Console errors:', filteredErrors);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
