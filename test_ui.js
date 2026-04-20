const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });

  await page.goto('http://localhost:8080/index.html');
  await page.waitForTimeout(2000); // Wait for things to settle

  // Evaluate script to forcefully populate details to see layout
  await page.evaluate(() => {
    document.getElementById('room-details').classList.remove('hidden');
    const container = document.getElementById('carousel-container');
    container.innerHTML = `
      <div class="carousel-item" style="height: 200px; background: red;"></div>
      <div class="carousel-item" style="height: 200px; background: blue;"></div>
      <div class="carousel-item" style="height: 200px; background: green;"></div>
      <div class="carousel-item" style="height: 200px; background: yellow;"></div>
    `;
  });
  await page.waitForTimeout(500);

  await page.screenshot({ path: 'desktop_horizontal_scroll.png' });

  await browser.close();
})();
