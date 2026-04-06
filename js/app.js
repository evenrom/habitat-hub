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
        // Fetch, sanitize, and inject floor plan SVG via UI controller
        await UI.loadAndInjectSVG('./assets/floorplan.svg');

        // Wire map events after SVG is injected
        UI.initMapEvents((roomId) => {
            Store.setState({ currentRoom: roomId });
            const filteredItems = Store.state.items.filter(item => {
                const roomMatch = item.room === roomId;
                const storeMatch = Store.state.currentStore === 'All' || item.store === Store.state.currentStore;
                return roomMatch && storeMatch;
            });
            UI.renderCarousel(filteredItems);
        });

        const data = await fetchAPI('getInitialData');
        Store.setState({
            config: data.config || {},
            items: data.items || [],
            isLoading: false
        });

        // Populate Store Filter
        const storeFilter = document.getElementById('store-filter');
        if (storeFilter && Store.state.items) {
            const uniqueStores = [...new Set(Store.state.items.map(item => item.store).filter(store => store && store.trim() !== ''))];
            uniqueStores.sort().forEach(storeName => {
                const option = document.createElement('option');
                option.value = storeName;
                option.textContent = storeName;
                option.style.background = '#121212';
                storeFilter.appendChild(option);
            });

            // Cross-Filtering Logic
            storeFilter.addEventListener('change', (e) => {
                const selectedStore = e.target.value;
                Store.setState({ currentStore: selectedStore });

                const filteredItems = Store.state.items.filter(item => {
                    const roomMatch = !Store.state.currentRoom || item.room === Store.state.currentRoom;
                    const storeMatch = selectedStore === 'All' || item.store === selectedStore;
                    return roomMatch && storeMatch;
                });

                UI.renderCarousel(filteredItems);
            });
        }

        // Trigger initial budget render
        UI.updateBudget(Store.getBudgetStats());

        // --- הוספנו את זה עכשיו: Setup Magic AI Add Modal Logic ---
        const fabButton = document.getElementById('fab');
        const addModal = document.getElementById('add-modal');
        const closeAddBtn = document.getElementById('close-add-modal');
        const cancelAddBtn = document.getElementById('cancel-add');

        if (fabButton && addModal) {
            const hideAddModal = () => addModal.classList.add('hidden');
            
            // פתיחת המודאל בלחיצה על כפתור הפלוס
            fabButton.addEventListener('click', () => addModal.classList.remove('hidden'));
            
            // סגירת המודאל
            if (closeAddBtn) closeAddBtn.addEventListener('click', hideAddModal);
            if (cancelAddBtn) cancelAddBtn.addEventListener('click', hideAddModal);
            
            // סגירה בלחיצה על הרקע השחור מחוץ לחלון
            window.addEventListener('click', (e) => { 
                if (e.target === addModal) hideAddModal(); 
            });
        }
        
    } catch (error) {
        console.error('Failed to load initial data:', error);
        alert('שגיאת מערכת: Failed to load application data. Please try again later.');
        Store.setState({ isLoading: false });
    }
}

document.addEventListener('DOMContentLoaded', init);
