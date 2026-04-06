const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    // Listen for console logs
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));

    // Load local server
    await page.goto('http://localhost:8080');

    // Wait for everything to settle
    await page.waitForTimeout(3000);

    // Mock data for test
    await page.evaluate(() => {
        window.Store.setState({
            items: [
                { id: '1', type: 'Main', name: 'Cool Sofa', price: 1000, room: 'living_room' },
                { id: '2', type: 'Alternative', name: 'Other Sofa', price: 900, room: 'living_room', parent_id: '1' }
            ]
        });
        window.UI.renderCarousel(window.Store.getRoomItems('living_room'));
    });

    // Open main item modal
    await page.evaluate(() => {
        const item = window.Store.state.items[0];
        window.UI.openModal(item, 'https://via.placeholder.com/300');
    });

    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'modal_with_alt.png' });

    // Click on the alternative to trigger comparison modal
    await page.evaluate(() => {
        const altRow = document.querySelector('.alt-item-row');
        if (altRow) altRow.click();
    });

    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'comparison_modal.png' });

    // Optional: trigger swap logic to ensure it doesn't crash completely
    // We expect fetch errors because we aren't mocking fetchAPI fully, but we just check if the UI tries to react
    await page.evaluate(() => {
        const btn = document.getElementById('btn-select-primary');
        if (btn) btn.click();
    });

    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'after_swap_click.png' });

    await browser.close();
})();
