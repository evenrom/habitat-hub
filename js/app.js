import { fetchAPI } from './api.js';
import { Store } from './store.js';
import { UI } from './ui.js';

async function init() {
    console.log('Habitat-Hub v2.0 App Starting...');

    // Wire UI budget updates to Store
    Store.subscribe((state) => {
        UI.updateBudget(Store.getBudgetStats());
    });

    try {
        // Fetch and inject floor plan SVG
        const svgResponse = await fetch('./assets/floorplan.svg');
        if (svgResponse.ok) {
            const svgText = await svgResponse.text();
            document.getElementById('hero-map').innerHTML = svgText;
        } else {
            console.error('Failed to load floorplan.svg');
        }

        // Wire map events after SVG is injected
        UI.initMapEvents((roomId) => {
            Store.setState({ currentRoom: roomId });
            UI.renderCarousel(Store.getRoomItems(roomId));
        });

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
