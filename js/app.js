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
        
        const step1 = document.getElementById('add-step-1');
        const step2 = document.getElementById('add-step-2');
        const dropzone = document.getElementById('add-dropzone');
        const fileInput = document.getElementById('add-file-input');
        const urlInput = document.getElementById('add-url-input');
        const analyzeBtn = document.getElementById('btn-analyze');
        const btnText = document.getElementById('add-btn-text');
        const dropzoneText = document.getElementById('add-dropzone-text');
        
        // Review Fields
        const btnBackEdit = document.getElementById('btn-back-edit');
        const btnConfirmSave = document.getElementById('btn-confirm-save');
        const reviewImg = document.getElementById('review-img');
        
        let currentBase64Image = null;
        let pendingItemData = null; // ישמור את הנתונים עד לאישור

        if (fabButton && addModal) {
            const hideAddModal = () => {
                addModal.classList.add('hidden');
                step1.classList.remove('hidden');
                step2.classList.add('hidden');
                currentBase64Image = null;
                pendingItemData = null;
                if(urlInput) urlInput.value = '';
                if(dropzoneText) dropzoneText.textContent = 'Drop image, click, or Ctrl+V to paste';
                if(btnText) btnText.textContent = '🪄 Analyze';
                if(analyzeBtn) analyzeBtn.disabled = false;
                if(btnConfirmSave) btnConfirmSave.innerHTML = '✓ CONFIRM & SAVE';
                if(btnConfirmSave) btnConfirmSave.disabled = false;
            };
            
            fabButton.addEventListener('click', () => addModal.classList.remove('hidden'));
            if (closeAddBtn) closeAddBtn.addEventListener('click', hideAddModal);
            if (cancelAddBtn) cancelAddBtn.addEventListener('click', hideAddModal);
            window.addEventListener('click', (e) => { if (e.target === addModal) hideAddModal(); });

            // תמיכה ב-Ctrl+V (Paste) ברמת החלון
            window.addEventListener('paste', (e) => {
                if (!addModal.classList.contains('hidden') && !step1.classList.contains('hidden')) {
                    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
                    for (const item of items) {
                        if (item.type.indexOf('image') === 0) {
                            const blob = item.getAsFile();
                            handleFile(blob);
                            break;
                        }
                    }
                }
            });

            // העלאת תמונה רגילה
            if(dropzone && fileInput) {
                dropzone.addEventListener('click', () => fileInput.click());
                dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.style.borderColor = 'var(--sage-green)'; });
                dropzone.addEventListener('dragleave', () => dropzone.style.borderColor = 'var(--border-light)');
                dropzone.addEventListener('drop', (e) => {
                    e.preventDefault(); dropzone.style.borderColor = 'var(--border-light)';
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
                });
                fileInput.addEventListener('change', (e) => {
                    if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
                });
            }

            function handleFile(file) {
                dropzoneText.textContent = `Attached: ${file.name || 'Pasted Image'}`;
                const reader = new FileReader();
                reader.onload = (e) => { 
                    currentBase64Image = e.target.result; 
                    reviewImg.src = currentBase64Image; // הכנה מראש למסך הביקורת
                };
                reader.readAsDataURL(file);
            }

            // שלב 1: לחיצה על "Analyze" (ניתוח ומעבר למסך עריכה)
            if (analyzeBtn) {
                analyzeBtn.addEventListener('click', async () => {
                    const url = urlInput.value.trim();
                    if (!url && !currentBase64Image) { alert('Please paste an image or URL.'); return; }

                    try {
                        analyzeBtn.disabled = true;
                        btnText.textContent = '⏳ Analyzing...';

                        const analyzeRes = await fetchAPI('analyzeAndUpload', { base64Image: currentBase64Image, productURL: url });
                        const extracted = analyzeRes.extractedData || {};
                        
                        // שמירת הנתונים זמנית
                        pendingItemData = {
                            room: Store.state.currentRoom || 'Unassigned',
                            type: 'Main', parent_id: '',
                            image_id: analyzeRes.image_id || '',
                            product_url: url, is_purchased: false
                        };

                        // אכלוס שדות העריכה
                        document.getElementById('review-name').value = extracted.name || '';
                        document.getElementById('review-price').value = extracted.price || '';
                        document.getElementById('review-store').value = extracted.store || '';
                        document.getElementById('review-l').value = extracted.dim_l || '';
                        document.getElementById('review-w').value = extracted.dim_w || '';
                        document.getElementById('review-h').value = extracted.dim_h || '';
                        
                        // אם אין תמונה, נשים פלייסחולדר
                        if (!currentBase64Image) reviewImg.src = 'https://via.placeholder.com/150?text=No+Image';

                        // מעבר למסך השני
                        step1.classList.add('hidden');
                        step2.classList.remove('hidden');
                        
                    } catch (error) {
                        console.error('Analyze Error:', error);
                        alert('Failed to analyze. Please try again.');
                        btnText.textContent = '🪄 Analyze';
                        analyzeBtn.disabled = false;
                    }
                });
            }

            // חזרה מביקורת אחורה
            if (btnBackEdit) {
                btnBackEdit.addEventListener('click', () => {
                    step2.classList.add('hidden');
                    step1.classList.remove('hidden');
                    btnText.textContent = '🪄 Analyze';
                    analyzeBtn.disabled = false;
                });
            }

            // שלב 2: אישור ושמירה סופית
            if (btnConfirmSave) {
                btnConfirmSave.addEventListener('click', async () => {
                    try {
                        btnConfirmSave.disabled = true;
                        btnConfirmSave.textContent = '⏳ SAVING...';

                        // עדכון הנתונים הזמניים לפי מה שהמשתמש ערך
                        pendingItemData.name = document.getElementById('review-name').value;
                        pendingItemData.price = Number(document.getElementById('review-price').value) || 0;
                        pendingItemData.store = document.getElementById('review-store').value;
                        pendingItemData.dim_l = document.getElementById('review-l').value;
                        pendingItemData.dim_w = document.getElementById('review-w').value;
                        pendingItemData.dim_h = document.getElementById('review-h').value;

                        const saveRes = await fetchAPI('saveItem', { item: pendingItemData });
                        
                        pendingItemData.id = saveRes.id;
                        Store.setState({ items: [...Store.state.items, pendingItemData] });
                        
                        if (Store.state.currentRoom) {
                            const filteredItems = Store.state.items.filter(item => 
                                item.room === Store.state.currentRoom && 
                                (Store.state.currentStore === 'All' || item.store === Store.state.currentStore) &&
                                String(item.type).toLowerCase() !== 'alternative'
                            );
                            UI.renderCarousel(filteredItems);
                        }
                        
                        hideAddModal();
                    } catch (error) {
                        console.error('Save Error:', error);
                        alert('Failed to save item.');
                        btnConfirmSave.innerHTML = '✓ CONFIRM & SAVE';
                        btnConfirmSave.disabled = false;
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