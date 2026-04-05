export const UI = {
    init() {
        console.log('UI initialized');
        // Setup initial UI components and event listeners here
        this.render();
    },

    render() {
        const appDiv = document.getElementById('app');
        if (appDiv) {
            appDiv.innerHTML = `
                <div class="glass-panel" style="padding: 2rem; margin: 2rem auto; max-width: 600px; text-align: center; border-radius: 12px;">
                    <h1>Habitat-Hub v2.0</h1>
                    <p>App initialization successful.</p>
                </div>
            `;
        }
    }
};
