import { fetchAPI } from './api.js';
import { Store } from './store.js';
import { UI } from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
    console.log('Habitat-Hub v2.0 App Starting...');

    // Initialize UI
    UI.init();

    // Example: Subscribe to store changes
    Store.subscribe((state) => {
        console.log('Store state changed:', state);
        // UI.render(state); // Update UI based on new state
    });

    // Example: Initial API load (commented out to prevent errors if API isn't ready)
    /*
    async function loadInitialData() {
        try {
            const data = await fetchAPI('getInitialData');
            Store.setState({ items: data.items, config: data.config, isLoading: false });
        } catch (error) {
            console.error('Failed to load initial data', error);
            Store.setState({ isLoading: false });
        }
    }

    loadInitialData();
    */

    Store.setState({ isLoading: false });
});
