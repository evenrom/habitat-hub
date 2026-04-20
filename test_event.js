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
      await route.fulfill({
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
      return;
    }

    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'Access-Control-Allow-Origin': '*'
        },
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

  // Mock SVG to include a test node
  await page.route('**/assets/floorplan.svg', async route => {
      await route.fulfill({
          status: 200,
          contentType: 'image/svg+xml',
          body: `<svg viewBox="0 0 100 100"><circle class="render-node" id="test_node" cx="50" cy="50" r="10"/></svg>`
      });
  });

  console.log('Navigating to http://localhost:8080/index.html...');
  await page.goto('http://localhost:8080/index.html', { waitUntil: 'networkidle' });

  try {
    await page.waitForTimeout(500);

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

    // Simulate re-population of renders for testing
    await page.evaluate(() => {
        window.Store.setState({ renders: [{ node_id: "test_node", title: "Living Room View", drive_image_id: "fake_id" }] });
        window.UI.initMapEvents(() => {});
    });

    // Test Pointer Events and Cursor on Render Node explicitly setting inline bounding box
    const nodeStyles = await page.evaluate(() => {
        const node = document.querySelector('.render-node');
        if (!node) return null;
        const styles = window.getComputedStyle(node);
        return { pointerEvents: styles.pointerEvents, cursor: styles.cursor };
    });
    console.log('Render Node Styles:', nodeStyles);

    // Dispatch a click onto the node bubbling up to #hero-map delegated listener
    await page.evaluate(() => {
        const node = document.getElementById('test_node');
        // A standard .click() sometimes doesn't bubble in SVG mocks natively within Playwright, so we trigger a bubbling event:
        const event = new MouseEvent('click', {
             bubbles: true,
             cancelable: true,
             view: window
        });
        node.dispatchEvent(event);
    });

    await page.waitForTimeout(200);

    const isModalVisibleAndHasCorrectSrc = await page.evaluate(() => {
       const modal = document.getElementById('render-modal');
       if (!modal || modal.classList.contains('hidden')) return false;
       const img = document.getElementById('render-modal-img');
       return img.src.includes('drive.google.com/thumbnail?id=fake_id&sz=w1600');
    });
    console.log('Modal visible and mapped via delegation:', isModalVisibleAndHasCorrectSrc);
    if (!isModalVisibleAndHasCorrectSrc) throw new Error('Modal did not open or src is incorrect. Delegation failed.');

    // Ignore Favicon errors usually caused by browser requesting standard favicon
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
