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

        // --- Setup Magic AI Add Modal Logic ---
        const fabButton = document.getElementById('fab');
        const addModal = document.getElementById('add-modal');
        const closeAddBtn = document.getElementById('close-add-modal');
        const cancelAddBtn = document.getElementById('cancel-add');
        
        const dropzone = document.getElementById('add-dropzone');
        const fileInput = document.getElementById('add-file-input');
        const urlInput = document.getElementById('add-url-input');
        const analyzeSaveBtn = document.getElementById('btn-analyze-save');
        const btnText = document.getElementById('add-btn-text');
        const dropzoneText = document.getElementById('add-dropzone-text');
        
        let currentBase64Image = null;

        if (fabButton && addModal) {
            const hideAddModal = () => {
                addModal.classList.add('hidden');
                currentBase64Image = null;
                if(urlInput) urlInput.value = '';
                if(dropzoneText) dropzoneText.textContent = 'Drop image or click to upload';
                if(btnText) btnText.textContent = '🪄 Analyze & Save';
                if(analyzeSaveBtn) analyzeSaveBtn.disabled = false;
            };
            
            fabButton.addEventListener('click', () => addModal.classList.remove('hidden'));
            if (closeAddBtn) closeAddBtn.addEventListener('click', hideAddModal);
            if (cancelAddBtn) cancelAddBtn.addEventListener('click', hideAddModal);
            window.addEventListener('click', (e) => { if (e.target === addModal) hideAddModal(); });

            // טיפול בהעלאת תמונה (Drag & Drop + Click)
            if(dropzone && fileInput) {
                dropzone.addEventListener('click', () => fileInput.click());
                
                dropzone.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    dropzone.style.borderColor = 'var(--sage-green)';
                });
                dropzone.addEventListener('dragleave', () => dropzone.style.borderColor = 'var(--border-light)');
                dropzone.addEventListener('drop', (e) => {
                    e.preventDefault();
                    dropzone.style.borderColor = 'var(--border-light)';
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
                });
                
                fileInput.addEventListener('change', (e) => {
                    if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
                });

                function handleFile(file) {
                    dropzoneText.textContent = `Selected: ${file.name}`;
                    const reader = new FileReader();
                    reader.onload = (e) => { currentBase64Image = e.target.result; };
                    reader.readAsDataURL(file);
                }
            }

            // לחיצה על "Analyze & Save"
            if (analyzeSaveBtn) {
                analyzeSaveBtn.addEventListener('click', async () => {
                    const url = urlInput.value.trim();
                    if (!url && !currentBase64Image) {
                        alert('Please provide an image or a URL to analyze.');
                        return;
                    }

                    try {
                        analyzeSaveBtn.disabled = true;
                        btnText.textContent = '⏳ Analyzing...';

                        // 1. קריאה לשרת לניתוח AI
                        const analyzeRes = await fetchAPI('analyzeAndUpload', {
                            base64Image: currentBase64Image,
                            productURL: url
                        });

                        btnText.textContent = '💾 Saving...';

                        // 2. הכנת אובייקט הפריט החדש מהנתונים שחזרו
                        const extracted = analyzeRes.extractedData || {};
                        const newItem = {
                            room: Store.state.currentRoom || 'Unassigned',
                            type: 'Main',
                            parent_id: '',
                            name: extracted.name || 'New Asset',
                            price: extracted.price || 0,
                            dim_l: extracted.dim_l || '',
                            dim_w: extracted.dim_w || '',
                            dim_h: extracted.dim_h || '',
                            store: extracted.store || '',
                            product_url: url,
                            image_id: analyzeRes.image_id || '',
                            is_purchased: false
                        };

                        // 3. שמירה ב-DB (Google Sheets)
                        const saveRes = await fetchAPI('saveItem', { item: newItem });
                        
                        // 4. עדכון הדפדפן (ללא ריענון עמוד)
                        newItem.id = saveRes.id;
                        Store.setState({ items: [...Store.state.items, newItem] });
                        
                        if (Store.state.currentRoom) {
                            const filteredItems = Store.state.items.filter(item => 
                                item.room === Store.state.currentRoom && 
                                (Store.state.currentStore === 'All' || item.store === Store.state.currentStore)
                            );
                            UI.renderCarousel(filteredItems);
                        }
                        
                        hideAddModal();
                        
                    } catch (error) {
                        console.error('Add Item Error:', error);
                        alert('Failed to add item. Ensure Google Script is active and correct.');
                        btnText.textContent = '🪄 Analyze & Save';
                        analyzeSaveBtn.disabled = false;
                    }
                });
            }
        }

        // --- Setup Finance Dashboard Modal Logic ---
        const financeBtn = document.getElementById('open-finance');
        const financeModal = document.getElementById('finance-modal');
        const closeFinanceBtn = document.getElementById('close-finance-modal');

        if (financeBtn && financeModal) {
            const hideFinance = () => financeModal.classList.add('hidden');
            financeBtn.addEventListener('click', () => {
                UI.renderFinanceDashboard(Store.state.items);
                financeModal.classList.remove('hidden');
            });
            if (closeFinanceBtn) closeFinanceBtn.addEventListener('click', hideFinance);
            window.addEventListener('click', (e) => { 
                if (e.target === financeModal) hideFinance(); 
            });
        }

    } catch (error) {
        console.error('Failed to load initial data:', error);
        alert('שגיאת מערכת: Failed to load application data. Please try again later.');
        Store.setState({ isLoading: false });
    }
}

document.addEventListener('DOMContentLoaded', init);