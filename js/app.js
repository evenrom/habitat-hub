import { fetchAPI } from './api.js';
import { Store } from './store.js';
import { UI } from './ui.js';

async function init() {
    console.log('Habitat-Hub v2.0 App Starting...');

    // Wire UI budget updates to Store
    Store.subscribe((state) => {
        UI.updateBudget(Store.getBudgetStats());
    });

    // Load and inject SVG map before initializing events
    await UI.loadAndInjectSVG('./assets/floorplan.svg');

    // Wire map events
    UI.initMapEvents((roomId) => {
        Store.setState({ currentRoom: roomId });
        UI.renderCarousel(Store.getRoomItems(roomId));
    });

    try {
        const data = await fetchAPI('getInitialData');
        Store.setState({
            config: data.config || {},
            items: data.items || [],
            isLoading: false
        });

        // Trigger initial budget render
        UI.updateBudget(Store.getBudgetStats());

    } catch (error) {
        console.error('Failed to load initial data:', error);
        alert('שגיאת מערכת: Failed to load application data. Please try again later.');
        Store.setState({ isLoading: false });
    }
}

document.addEventListener('DOMContentLoaded', init);
