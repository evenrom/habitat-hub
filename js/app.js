import { fetchAPI } from './api.js';
import { Store } from './store.js';
import { UI } from './ui.js';

async function init() {
    console.log('Habitat-Hub v2.0 App Starting...');

    UI.initEscapeListener();

    Store.subscribe(() => {
        UI.updateBudget(Store.getBudgetStats());
        UI.renderPlanner();
    });

    try {
        await UI.loadAndInjectSVG('./assets/floorplan.svg');
        UI.initMapEvents(roomId => UI.selectRoom(roomId));
        document.getElementById('btn-view-stores').addEventListener('click', () => {
            Store.setState({ viewMode: 'stores', currentRoom: 'All', purchaseFilter: 'to-buy' });
            UI.focusResults();
        });
        document.getElementById('btn-view-rooms').addEventListener('click', () => {
            Store.setState({ viewMode: 'rooms', currentRoom: 'All' });
        });
        document.querySelectorAll('[data-purchase]').forEach(button => {
            button.addEventListener('click', () => Store.setState({ purchaseFilter: button.dataset.purchase }));
        });
        document.querySelectorAll('[data-priority]').forEach(button => {
            button.addEventListener('click', () => Store.setState({ priorityFilter: button.dataset.priority }));
        });
        document.getElementById('store-filter').addEventListener('change', event => {
            Store.setState({ currentStore: event.target.value });
        });
        document.getElementById('reset-filters').addEventListener('click', () => {
            Store.setState({ currentRoom: 'All', currentStore: 'All', purchaseFilter: 'all', priorityFilter: 'all' });
        });

        const data = await fetchAPI('getInitialData');
        Store.setState({
            config: data.config || {},
            renders: data.renders || [],
            items: data.items || [],
            isLoading: false
        });

        // --- Setup Magic AI Add Modal Logic ---
        let cropper = null;
        function initCropper() {
            if (cropper) {
                cropper.destroy();
            }
            cropper = new Cropper(reviewImg, { viewMode: 1, autoCropArea: 1, aspectRatio: 3 / 2 });
        }

        const fabButton = document.getElementById('fab') || document.querySelector('.fab-pill');
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
                if (cropper) {
                    cropper.destroy();
                    cropper = null;
                }
                addModal.classList.add('hidden');
                if (step2) { step2.style.opacity = '0.4'; step2.style.pointerEvents = 'none'; }
                currentBase64Image = null;
                pendingItemData = null;
                window.pendingEditItem = null;
                if(urlInput) urlInput.value = '';
                if(dropzoneText) dropzoneText.textContent = 'Drop image, click, or Ctrl+V to paste';
                if(btnText) btnText.textContent = 'Analyze';
                if(analyzeBtn) analyzeBtn.disabled = false;
                const extractBtn = document.getElementById('btn-extract-ai');
                if (extractBtn) extractBtn.disabled = false;
                if(btnConfirmSave) btnConfirmSave.innerHTML = 'CONFIRM & SAVE';
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
                dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.style.borderColor = 'var(--actions)'; });
                dropzone.addEventListener('dragleave', () => dropzone.style.borderColor = 'rgba(173, 171, 158, 0.15)');
                dropzone.addEventListener('drop', (e) => {
                    e.preventDefault(); dropzone.style.borderColor = 'rgba(173, 171, 158, 0.15)';
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

            // AI Extraction Logic extracted into a named function
            const handleAiExtraction = async () => {
                const url = urlInput ? urlInput.value.trim() : '';
                if (!url && !currentBase64Image) { alert('Please paste an image or URL.'); return; }

                try {
                    if (analyzeBtn) analyzeBtn.disabled = true;
                    if (btnText) btnText.textContent = 'Analyzing...';

                    const extractBtn = document.getElementById('btn-extract-ai');
                    if (extractBtn) extractBtn.disabled = true;

                    const analyzeRes = await fetchAPI('analyzeAndUpload', { base64Image: currentBase64Image, productURL: url });
                    const extracted = analyzeRes.extractedData || {};
                    
                    // שמירת הנתונים זמנית
                    pendingItemData = {
                        room: Store.state.currentRoom || 'Unassigned',
                        type: 'Main', parent_id: '',
                        image_id: analyzeRes.image_id || '',
                        product_url: url, is_purchased: false
                    };

                    // Inject Nice-to-have Toggle dynamically if missing
                    if (!document.getElementById('review-nice-to-have')) {
                        const niceHtml = `
                            <div id="nice-to-have-container" style="margin-top: 16px; display: flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.05); padding: 12px; border-radius: 8px; border: 1px solid rgba(173, 171, 158, 0.15);">
                                <input type="checkbox" id="review-nice-to-have" style="width: 18px; height: 18px; cursor: pointer; accent-color: var(--actions);">
                                <label for="review-nice-to-have" style="font-size: 14px; color: var(--text-primary); cursor: pointer; user-select: none;">Nice-to-have</label>
                            </div>
                        `;
                        const reviewStore = document.getElementById('review-store');
                        if (reviewStore && reviewStore.parentNode) {
                            reviewStore.parentNode.insertAdjacentHTML('afterend', niceHtml);
                        }
                    }

                    // Handle visual state for Alternatives
                    const niceContainer = document.getElementById('nice-to-have-container');
                    const isAlternative = window.pendingAlternativeParentId;
                    if (niceContainer) {
                        if (isAlternative) {
                            niceContainer.style.opacity = '0.5';
                            niceContainer.style.pointerEvents = 'none';
                        } else {
                            niceContainer.style.opacity = '1';
                            niceContainer.style.pointerEvents = 'auto';
                        }
                    }

                    // אכלוס שדות העריכה
                    document.getElementById('review-name').value = extracted.name || '';
                    document.getElementById('review-price').value = extracted.price || '';
                    document.getElementById('review-store').value = extracted.store || '';
                    document.getElementById('review-l').value = extracted.dim_l || '';
                    document.getElementById('review-w').value = extracted.dim_w || '';
                    document.getElementById('review-h').value = extracted.dim_h || '';
                    const niceEl = document.getElementById('review-nice-to-have');
                    if (niceEl) niceEl.checked = false;
                    
                    // אם אין תמונה, נשים פלייסחולדר
                    if (!currentBase64Image) reviewImg.src = 'https://via.placeholder.com/150?text=No+Image';

                    // מעבר למסך השני
                    if (step2) { step2.style.opacity = '1'; step2.style.pointerEvents = 'auto'; }
                    
                    setTimeout(() => initCropper(), 100);

                } catch (error) {
                    console.error('Analyze Error:', error);
                    alert('Failed to analyze. Please try again.');
                    if (btnText) btnText.textContent = 'Analyze';
                    if (analyzeBtn) analyzeBtn.disabled = false;
                    const extractBtn = document.getElementById('btn-extract-ai');
                    if (extractBtn) extractBtn.disabled = false;
                }
            };

            // שלב 1: לחיצה על "Analyze" (ניתוח ומעבר למסך עריכה)
            if (analyzeBtn) {
                analyzeBtn.addEventListener('click', handleAiExtraction);
            }
            
            const btnExtractAi = document.getElementById('btn-extract-ai');
            if (btnExtractAi) {
                btnExtractAi.addEventListener('click', handleAiExtraction);
            }

            // שלב 2: אישור ושמירה סופית
            if (btnConfirmSave) {
                btnConfirmSave.addEventListener('click', async () => {
                    try {
                        btnConfirmSave.disabled = true;
                        btnConfirmSave.textContent = 'SAVING...';

                        if (window.pendingEditItem) {
                            pendingItemData = window.pendingEditItem;
                        } else if (!pendingItemData) {
                            // Fallback initialization just in case, though it should be set in step 1
                            pendingItemData = {
                                room: Store.state.currentRoom || 'Unassigned',
                                type: 'Main', parent_id: '',
                                image_id: '', product_url: '', is_purchased: false
                            };
                        }

                        const croppedBase64 = cropper ? cropper.getCroppedCanvas().toDataURL('image/jpeg', 0.8) : null;
                        if (croppedBase64) {
                            const uploadRes = await fetchAPI('uploadImage', { base64Image: croppedBase64 });
                            pendingItemData.image_id = uploadRes.image_id;
                        }

                        // עדכון הנתונים הזמניים לפי מה שהמשתמש ערך
                        pendingItemData.name = document.getElementById('review-name').value;
                        pendingItemData.price = Number(document.getElementById('review-price').value) || 0;
                        pendingItemData.store = document.getElementById('review-store').value;
                        pendingItemData.dim_l = document.getElementById('review-l').value;
                        pendingItemData.dim_w = document.getElementById('review-w').value;
                        pendingItemData.dim_h = document.getElementById('review-h').value;
                        
                        const niceEl = document.getElementById('review-nice-to-have');
                        pendingItemData.is_nice_to_have = niceEl ? niceEl.checked : false;

                        if (!pendingItemData.id) {
                            if (window.pendingAlternativeParentId) {
                                pendingItemData.type = 'Alternative';
                                pendingItemData.parent_id = window.pendingAlternativeParentId;
                            } else {
                                pendingItemData.type = 'Main';
                                pendingItemData.parent_id = '';
                            }
                        }

                        if (pendingItemData.id) {
                            await fetchAPI('updateItem', { item: pendingItemData });
                            Store.setState({ 
                                items: Store.state.items.map(i => i.id === pendingItemData.id ? pendingItemData : i) 
                            });
                        } else {
                            const saveRes = await fetchAPI('saveItem', { item: pendingItemData });
                            pendingItemData.id = saveRes.id;
                            Store.setState({ items: [...Store.state.items, pendingItemData] });
                        }
                        
                        window.pendingAlternativeParentId = null;
                        window.pendingEditItem = null;

                        UI.updateBudget(Store.getBudgetStats());
                        
                        hideAddModal();
                    } catch (error) {
                        console.error('Save Error:', error);
                        alert('Failed to save item.');
                        btnConfirmSave.innerHTML = 'CONFIRM & SAVE';
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