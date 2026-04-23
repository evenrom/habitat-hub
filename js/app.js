import { fetchAPI } from './api.js';
import { Store } from './store.js';
import { UI } from './ui.js';

async function init() {
    console.log('Habitat-Hub v2.0 App Starting...');

    UI.initEscapeListener();

    // Wire UI budget updates to Store
    Store.subscribe((state) => {
        UI.updateBudget(Store.getBudgetStats());
    });

    try {
        // Fetch, sanitize, and inject floor plan SVG via UI controller
        await UI.loadAndInjectSVG('./assets/floorplan.svg');

        // Wire map events after SVG is injected
        UI.initMapEvents((roomId) => {
            Store.setState({ viewMode: 'rooms', currentRoom: roomId });
            document.getElementById('btn-view-rooms').classList.add('active');
            document.getElementById('btn-view-stores').classList.remove('active');
            UI.renderCarousel(Store.state.items);
        });
        
        // Wire View Toggles
        const btnViewRooms = document.getElementById('btn-view-rooms');
        const btnViewStores = document.getElementById('btn-view-stores');
        const btnCoreOnly = document.getElementById('btn-core-only');

        btnViewStores.addEventListener('click', () => {
            Store.setState({ viewMode: 'stores', currentRoom: 'All' });
            btnViewStores.classList.add('active');
            btnViewRooms.classList.remove('active');
            UI.renderCarousel(Store.state.items);
        });

        btnViewRooms.addEventListener('click', () => {
            Store.setState({ viewMode: 'rooms', currentRoom: 'All' });
            btnViewRooms.classList.add('active');
            btnViewStores.classList.remove('active');
            UI.renderCarousel(Store.state.items);
        });
        
        if (btnCoreOnly) {
            btnCoreOnly.addEventListener('click', () => {
                const isCoreOnly = !Store.state.coreOnly;
                Store.setState({ coreOnly: isCoreOnly });
                
                if (isCoreOnly) {
                    btnCoreOnly.style.background = 'rgba(255,255,255,0.1)';
                    btnCoreOnly.style.color = 'var(--text-primary)';
                } else {
                    btnCoreOnly.style.background = 'transparent';
                    btnCoreOnly.style.color = 'var(--text-secondary)';
                }
                
                UI.renderCarousel(Store.state.items);
            });
        }

        const data = await fetchAPI('getInitialData');
        Store.setState({
            config: data.config || {},
            renders: data.renders || [],
            items: data.items || [],
            isLoading: false
        });

        // (Deprecated) UI.initRenderNodes(Store.state.renders); // Moved securely to UI.initMapEvents

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

        // Initial render
        UI.renderCarousel(Store.state.items);

        // --- Setup Magic AI Add Modal Logic ---
        let cropper = null;
        function initCropper() {
            if (cropper) {
                cropper.destroy();
            }
            cropper = new Cropper(reviewImg, { viewMode: 1, autoCropArea: 1, aspectRatio: 3 / 2 });
        }

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
                if (cropper) {
                    cropper.destroy();
                    cropper = null;
                }
                addModal.classList.add('hidden');
                step1.classList.remove('hidden');
                step2.classList.add('hidden');
                currentBase64Image = null;
                pendingItemData = null;
                window.pendingEditItem = null;
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
                        step1.classList.add('hidden');
                        step2.classList.remove('hidden');
                        
                        setTimeout(() => initCropper(), 100);

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
                    if (cropper) {
                        cropper.destroy();
                        cropper = null;
                    }
                    if (window.pendingEditItem) {
                        // If we are backing out of an edit, fully cancel the flow and clear state
                        hideAddModal();
                    } else {
                        // Regular flow back to step 1
                        step2.classList.add('hidden');
                        step1.classList.remove('hidden');
                        btnText.textContent = '🪄 Analyze';
                        analyzeBtn.disabled = false;
                    }
                });
            }

            // שלב 2: אישור ושמירה סופית
            if (btnConfirmSave) {
                btnConfirmSave.addEventListener('click', async () => {
                    try {
                        btnConfirmSave.disabled = true;
                        btnConfirmSave.textContent = '⏳ SAVING...';

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
                                const parentItem = Store.state.items.find(i => i.id === window.pendingAlternativeParentId);
                                if (parentItem && String(parentItem.is_nice_to_have).toLowerCase() === String(pendingItemData.is_nice_to_have).toLowerCase()) {
                                    alert(`Validation Error: Alternative item cannot have the same Nice-to-have status as its Main item.`);
                                    btnConfirmSave.textContent = '✓ CONFIRM & SAVE';
                                    btnConfirmSave.disabled = false;
                                    return;
                                }
                                pendingItemData.type = 'Alternative';
                                pendingItemData.parent_id = window.pendingAlternativeParentId;
                            } else {
                                pendingItemData.type = 'Main';
                                pendingItemData.parent_id = '';
                            }
                        } else if (String(pendingItemData.type).toLowerCase() === 'alternative' && pendingItemData.parent_id) {
                            // Validate edits on existing alternative items
                            const parentItem = Store.state.items.find(i => i.id === pendingItemData.parent_id);
                            if (parentItem && String(parentItem.is_nice_to_have).toLowerCase() === String(pendingItemData.is_nice_to_have).toLowerCase()) {
                                alert(`Validation Error: Alternative item cannot have the same Nice-to-have status as its Main item.`);
                                btnConfirmSave.textContent = '✓ CONFIRM & SAVE';
                                btnConfirmSave.disabled = false;
                                return;
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

                        if (Store.state.currentRoom) {
                            const filteredItems = Store.state.items.filter(item => 
                                item.room === Store.state.currentRoom && 
                                (Store.state.currentStore === 'All' || item.store === Store.state.currentStore) &&
                                String(item.type).toLowerCase() !== 'alternative'
                            );
                            UI.renderCarousel(filteredItems);
                        }
                        UI.updateBudget(Store.getBudgetStats());
                        
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