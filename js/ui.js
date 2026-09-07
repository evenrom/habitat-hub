import { Store } from './store.js';
import { fetchAPI } from './api.js';

export const UI = {
    lazyLoadObserver: null,

    roomLabel(name) {
        return String(name).replace(/([a-z])([A-Z])/g, '$1 $2');
    },

    selectRoom(room) {
        Store.setState({ viewMode: 'rooms', currentRoom: room });
        this.focusResults();
    },

    focusResults() {
        const title = document.getElementById('results-title');
        title?.focus({ preventScroll: true });
        title?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },

    renderPlanner() {
        const state = Store.state;
        document.querySelectorAll('[data-purchase]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.purchase === state.purchaseFilter)));
        document.querySelectorAll('[data-priority]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.priority === state.priorityFilter)));
        for (const mode of ['rooms', 'stores']) {
            const button = document.getElementById('btn-view-' + mode);
            button.classList.toggle('active', state.viewMode === mode);
            button.setAttribute('aria-pressed', String(state.viewMode === mode));
        }
        document.querySelectorAll('.room-hitbox').forEach(hitbox => {
            hitbox.classList.toggle('selected', hitbox.dataset.roomId === state.currentRoom);
        });
        const select = document.getElementById('store-filter');
        const stores = [...new Set(state.items.filter(item => item?.id && String(item.type).toLowerCase() !== 'alternative').map(item => item.store).filter(Boolean))].sort();
        select.replaceChildren(new Option('All stores', 'All'), ...stores.map(name => new Option(name, name)));
        select.value = state.currentStore;
        this.renderCarousel();
    },

    initEscapeListener() {
        if (!this.escapeListenerAttached) {
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    const modals = document.querySelectorAll('.modal:not(.hidden)');
                    modals.forEach(modal => modal.classList.add('hidden'));
                }
            });
            this.escapeListenerAttached = true;
        }
    },

    initLazyLoading() {
        if (!this.lazyLoadObserver) {
            this.lazyLoadObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        if (img.dataset.src) {
                            img.src = img.dataset.src;
                            img.removeAttribute('data-src');
                        }
                        observer.unobserve(img);
                    }
                });
            }, { rootMargin: '0px 0px 50px 0px' });
        }
    },

    lazyLoadImage(imgElement) {
        this.initLazyLoading();
        this.lazyLoadObserver.observe(imgElement);
    },


    openRenderModal(imgUrl) {
        let renderModal = document.getElementById('render-modal');

        // Inject modal if it doesn't exist
        if (!renderModal) {
            renderModal = document.createElement('div');
            renderModal.id = 'render-modal';
            renderModal.className = 'modal hidden';
            renderModal.innerHTML = `
                <div class="modal-content" style="background: transparent; border: none; box-shadow: none; max-width: 90%; text-align: center; position: relative;">
                    <span class="close-btn-atelier" id="close-render-modal" style="right: 0; top: -40px;">&times;</span>
                    <img id="render-modal-img" src="" style="width: 100%; max-height: 85vh; object-fit: contain; border-radius: 8px;">
                </div>
            `;
            document.body.appendChild(renderModal);

            document.getElementById('close-render-modal').addEventListener('click', () => {
                renderModal.classList.add('hidden');
                document.getElementById('render-modal-img').src = ''; // Clear memory
            });
            renderModal.addEventListener('click', (e) => {
                if (e.target === renderModal) {
                    renderModal.classList.add('hidden');
                    document.getElementById('render-modal-img').src = '';
                }
            });
        }

        const imgEl = document.getElementById('render-modal-img');
        imgEl.src = imgUrl;
        renderModal.classList.remove('hidden');
    },

    updateBudget(stats) {
        if (!document.getElementById('finance-modal')?.classList.contains('hidden')) this.renderFinanceDashboard();
    },

    async loadAndInjectSVG(url) {
        try {
            const svgResponse = await fetch(url);
            if (svgResponse.ok) {
                const svgText = await svgResponse.text();
                document.getElementById('hero-map').innerHTML = svgText;

                const svgElement = document.querySelector('#hero-map svg');
                if (svgElement) {
                    const w = parseFloat(svgElement.getAttribute('width')) || 18500;
                    const h = parseFloat(svgElement.getAttribute('height')) || 20613;
                    if (!svgElement.getAttribute('viewBox')) {
                        svgElement.setAttribute('viewBox', `0 0 ${w} ${h}`);
                    }
                    svgElement.removeAttribute('width');
                    svgElement.removeAttribute('height');
                    svgElement.style.width = '100%';
                    svgElement.style.height = '100%';
                    svgElement.style.display = 'block';
                }
            } else {
                console.error('Failed to load floorplan.svg');
            }
        } catch (err) {
            console.error('Error fetching SVG:', err);
        }
    },

    initMapEvents(onRoomSelect) {
        console.log("🛠️ Debug: initMapEvents initialized.");

        // 1. Direct Binding for Render Nodes
        const renderNodes = document.querySelectorAll('.render-node');
        console.log(`🛠️ Debug: Found ${renderNodes.length} render nodes in the SVG.`);

        renderNodes.forEach(node => {
            node.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation(); // Block hitbox

                const nodeId = node.getAttribute('id');
                console.log(`🛠️ Debug: Clicked node -> ${nodeId}`);

                const renders = Store.state.renders || [];
                console.log(`🛠️ Debug: Current Store.state.renders:`, renders);

                const renderData = renders.find(r => r.node_id === nodeId);

                if (renderData && renderData.drive_image_id) {
                    console.log(`🛠️ Debug: Match found! Opening Modal for Drive ID: ${renderData.drive_image_id}`);
                    const imgUrl = `https://drive.google.com/thumbnail?id=${renderData.drive_image_id}&sz=w1600`;
                    UI.openRenderModal(imgUrl);
                } else {
                    console.error(`❌ Error: No matching render data found for node ID: ${nodeId}`);
                    alert(`Data Mismatch: Clicked ${nodeId}, but it's not in the Database mapping.`);
                }
            });
        });

        // 2. Direct Binding for Room Hitboxes (Existing logic)
        const hitboxes = document.querySelectorAll('.room-hitbox');


        hitboxes.forEach(hitbox => {
            // Apply vector effects...
            hitbox.setAttribute('vector-effect', 'non-scaling-stroke');
            const children = hitbox.querySelectorAll('*');
            children.forEach(child => {
                if (child.tagName.match(/^(path|rect|circle|polygon|line|polyline)$/i)) {
                    child.setAttribute('vector-effect', 'non-scaling-stroke');
                }
            });

            hitbox.addEventListener('click', (e) => {
                e.preventDefault();
                const roomId = hitbox.getAttribute('data-room-id');
                console.log(`🛠️ Debug: Clicked Room Hitbox -> ${roomId}`);

                onRoomSelect(roomId);
            });
        });

        // 3. Background Reset Event
        const heroMap = document.getElementById('hero-map');
        if (heroMap) {
            heroMap.addEventListener('click', (e) => {
                if (!e.target.closest('.room-hitbox') && !e.target.closest('.render-node')) {
                    console.log("🛠️ Debug: Clicked map background, resetting state.");
                    Store.setState({ viewMode: 'rooms', currentRoom: 'All' });
                    document.querySelectorAll('.room-hitbox').forEach(hb => hb.classList.remove('selected', 'active'));
                }
            });
        }
    },

    renderCarousel() {
        this.lazyLoadObserver?.disconnect();
        const section = document.getElementById('room-details');

        const mainItems = Store.getVisibleItems();
        section.classList.remove('hidden');
        const groups = Object.create(null);
        mainItems.forEach(item => {
            const groupName = (Store.state.viewMode === 'stores' ? item.store : item.room) || 'Unassigned';
            (groups[groupName] ||= []).push(item);
        });

        // Target 'room-details'. Clear innerHTML since we will build headers + carousels dynamically.
        // Also add the original container id to avoid changing the HTML layout.
        section.innerHTML = '<h2 id="results-title" tabindex="-1"></h2><p id="results-count" class="planner-note" role="status"></p><div id="carousel-container" style="display: flex; flex-direction: column; gap: 0;"></div>';
        document.getElementById('results-title').textContent = Store.state.viewMode === 'stores' ? 'Shopping by store' : (Store.state.currentRoom === 'All' ? 'Furniture' : UI.roomLabel(Store.state.currentRoom));
        document.getElementById('results-count').textContent = mainItems.length + ' matching item' + (mainItems.length === 1 ? '' : 's');
        const rootContainer = document.getElementById('carousel-container');

        if (Object.keys(groups).length === 0) {
             const empty = document.createElement('p');
             empty.className = 'planner-empty';
             empty.textContent = 'No furniture matches these filters. Try another status or priority, or reset filters.';
             rootContainer.appendChild(empty);
             return;
        }

        Object.keys(groups).sort((a, b) => a.localeCompare(b)).forEach(groupName => {
            const groupItems = groups[groupName];
            
            const groupHeader = document.createElement('h2');
            groupHeader.style.cssText = 'margin-top: 32px; font-size: 16px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.1em;';
            groupHeader.textContent = (Store.state.viewMode === 'rooms' ? UI.roomLabel(groupName) : groupName) + ' · ' + groupItems.length;
            rootContainer.appendChild(groupHeader);

            const container = document.createElement('div');
            container.className = 'carousel';
            // Important for multiple carousels stacked
            container.style.display = 'flex';
            container.style.gap = '16px';
            container.style.overflowX = 'auto';
            container.style.paddingBottom = '16px';
            container.style.marginBottom = '24px';
            
            const sortedItems = [...groupItems].sort((a, b) => {
                const aPurchased = a.is_purchased === true || String(a.is_purchased).toLowerCase() === 'true';
                const bPurchased = b.is_purchased === true || String(b.is_purchased).toLowerCase() === 'true';
                if (aPurchased !== bPurchased) return aPurchased ? 1 : -1;
                return (a.price || 0) - (b.price || 0);
            });

            sortedItems.forEach(item => {
                const isPurchased = item.is_purchased === true || String(item.is_purchased).toLowerCase() === 'true';
                const purchasedClass = isPurchased ? 'purchased' : '';

                const imgUrl = (item.image_id && item.image_id !== 'Unknown') ? 'https://lh3.googleusercontent.com/d/' + item.image_id : 'https://via.placeholder.com/300x200';

                const card = document.createElement('div');
                card.className = `carousel-item ${purchasedClass}`;
                card.style.cursor = 'pointer';
                card.dataset.itemId = item.id;

                card.innerHTML = `
                    <img data-src="${imgUrl}" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" alt="${item.name || 'Item'}">
                    <div class="details">
                        <h3 style="margin: 0; font-size: 1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.name || 'Unnamed Item'}</h3>
                        <p style="margin: 4px 0; color: #adab9e; font-weight: bold;">₪${new Intl.NumberFormat('en-US').format(item.price || 0)}</p>
                    </div>
                `;

                const tags = document.createElement('p');
                tags.className = 'item-tags';
                tags.textContent = (isPurchased ? 'Purchased' : 'To buy') + ' · ' + (String(item.is_nice_to_have).toLowerCase() === 'true' ? 'Nice to have' : 'Required');
                if (Store.state.viewMode === 'stores') tags.textContent += ' · ' + UI.roomLabel(item.room || 'Unassigned');
                card.querySelector('.details').appendChild(tags);
                const imgElem = card.querySelector('img');
                UI.lazyLoadImage(imgElem);

                card.addEventListener('click', () => UI.openModal(item, imgUrl));

                container.appendChild(card);
            });
            rootContainer.appendChild(container);
        });
    },
    openModal(item, imgUrl) {
        const modal = document.getElementById('item-modal');
        const modalImage = document.getElementById('modal-image');
        
        // Reset image opacity
        modalImage.style.opacity = '1';
        modalImage.src = imgUrl;
        
        document.getElementById('modal-title').textContent = item.name || 'Unnamed Item';
        
        // הגדרת מחיר (שימוש במחיר בפועל אם קיים)
        const displayPrice = item.actual_price ? item.actual_price : item.price;
        const priceLabel = item.actual_price ? 'PAID' : 'MSRP';
        
        const isPurchased = item.is_purchased === true || String(item.is_purchased).toLowerCase() === 'true';

        document.getElementById('modal-price').innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <span style="font-size: 10px; color: var(--text-secondary);">${priceLabel}</span>
                    <span style="font-size: 1.35rem; font-weight: 700;">₪${new Intl.NumberFormat('en-US').format(displayPrice || 0)}</span>
                </div>
                <div style="display: flex; align-items: center;">
                    ${isPurchased
                        ? `<span class="atelier-purchased-pill">Purchased</span>`
                        : `<button id="btn-mark-purchased" class="atelier-purchased-btn">Mark as Purchased</button>`
                    }
                </div>
            </div>
        `;
        
        // הרכבת אזור המפרט הטכני (Dimensions & Store)
        let detailsHtml = `<div style="margin-top: 24px; display: flex; flex-direction: column; gap: 16px;">`;
        
        // שורת חנות ולינק
        if (item.store || item.product_url) {
            detailsHtml += `
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(173, 171, 158, 0.15); padding-bottom: 12px;">
                <span style="color: var(--text-secondary); font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase;">Vendor / Store</span>
                <a href="${item.product_url || '#'}" target="_blank" style="color: var(--actions); text-decoration: none; font-weight: 600; font-size: 14px;">
                    ${item.store || 'View Store'} ↗
                </a>
            </div>`;
        }

        // שורת מידות
        if (item.dim_l || item.dim_w || item.dim_h) {
            detailsHtml += `
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(173, 171, 158, 0.15); padding-bottom: 12px;">
                <span style="color: var(--text-secondary); font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase;">Dimensions (L × W × H)</span>
                <span style="color: var(--text-primary); font-family: monospace; font-size: 14px;">
                    ${item.dim_l || '-'} × ${item.dim_w || '-'} × ${item.dim_h || '-'} cm
                </span>
            </div>`;
        }
        
        // חיפוש אלטרנטיבות המשויכות לפריט הזה
        if (Store && Store.state && Store.state.items) {
            const alternatives = Store.state.items.filter(alt => 
                String(alt.type).toLowerCase() === 'alternative' && alt.parent_id === item.id
            );

            if (alternatives.length > 0) {
                detailsHtml += `
                <div style="margin-top: 24px; border-top: 1px solid rgba(173, 171, 158, 0.15); padding-top: 16px;">
                    <span style="color: var(--text-secondary); font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase;">Curated Alternatives (${alternatives.length})</span>
                    <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 12px;">`;
                
                alternatives.forEach(alt => {
                    const altPrice = alt.actual_price ? alt.actual_price : alt.price;
                    detailsHtml += `
                        <div class="alt-item-row" data-alt-id="${alt.id}" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(173, 171, 158, 0.15); border-radius: 8px; padding: 12px; display: flex; justify-content: space-between; align-items: center; transition: background 0.2s; cursor: pointer;" onmouseover="this.style.background='rgba(255,255,255,0.06)'" onmouseout="this.style.background='rgba(255,255,255,0.02)'">
                            <div>
                                <div style="font-size: 13px; font-weight: 600; color: var(--text-primary);">${alt.name || 'Alternative Option'}</div>
                                <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">${alt.store || 'Unknown Store'}</div>
                            </div>
                            <div style="color: var(--actions); font-weight: bold; font-size: 14px;">
                                ₪${new Intl.NumberFormat('en-US').format(altPrice || 0)}
                            </div>
                        </div>`;
                });
                
                detailsHtml += `</div></div>`;
            }
        }

        if (isPurchased) {
            modalImage.style.opacity = '0.5';
        }

        detailsHtml += `
            <div style="display: flex; gap: 8px; margin-top: 16px;">
                <button id="btn-add-alt-inline" style="flex: 1; background: transparent; border: 1px dashed var(--actions); color: var(--actions); padding: 10px; border-radius: 8px; cursor: pointer;">Add Alternative</button>
                <button id="btn-edit-item" class="swap-button" style="flex: 1; margin: 0;">Edit Details</button>
            </div>
        </div>`;
        
        document.getElementById('modal-details').innerHTML = detailsHtml;

        const btnEditItem = document.getElementById('btn-edit-item');
        if (btnEditItem) {
            btnEditItem.addEventListener('click', () => {
                modal.classList.add('hidden');

                // Set the pending edit item globally for app.js to catch
                window.pendingEditItem = { ...item };

                // Make sure Nice-to-have UI exists
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
                const isAlternative = item.parent_id && String(item.type).toLowerCase() === 'alternative';
                if (niceContainer) {
                    if (isAlternative) {
                        niceContainer.style.opacity = '0.5';
                        niceContainer.style.pointerEvents = 'none';
                    } else {
                        niceContainer.style.opacity = '1';
                        niceContainer.style.pointerEvents = 'auto';
                    }
                }

                // Populate Add Modal fields
                document.getElementById('review-name').value = item.name || '';
                document.getElementById('review-price').value = item.price || '';
                document.getElementById('review-store').value = item.store || '';
                document.getElementById('review-l').value = item.dim_l || '';
                document.getElementById('review-w').value = item.dim_w || '';
                document.getElementById('review-h').value = item.dim_h || '';
                
                const niceEl = document.getElementById('review-nice-to-have');
                if (niceEl) niceEl.checked = String(item.is_nice_to_have).toLowerCase() === 'true';

                document.getElementById('review-img').src = imgUrl;

                // Open the modal and activate the edit pane (Step 2)
                const step1 = document.getElementById('add-step-1');
                const step2 = document.getElementById('add-step-2');
                if (step1) { step1.style.opacity = '0.4'; step1.style.pointerEvents = 'none'; }
                if (step2) { step2.style.opacity = '1'; step2.style.pointerEvents = 'auto'; }
                document.getElementById('add-modal').classList.remove('hidden');
            });
        }

        // --- חיבור אירוע לכפתור הנרכש ---
        const btnMarkPurchased = document.getElementById('btn-mark-purchased');
        if (btnMarkPurchased) {
            btnMarkPurchased.addEventListener('click', async () => {
                btnMarkPurchased.textContent = 'Saving...';
                btnMarkPurchased.disabled = true;
                btnMarkPurchased.style.opacity = '0.7';
                
                try {
                    await fetchAPI('updateItem', { item: { id: item.id, is_purchased: true } });
                    
                    // Update local state
                    const storeItem = Store.state.items.find(i => i.id === item.id);
                    if (storeItem) {
                        storeItem.is_purchased = true;
                    }
                    
                    // Trigger UI re-render
                    Store.setState({ items: Store.state.items });
                    UI.updateBudget(Store.getBudgetStats());
                    
                    // Re-open modal to show updated state
                    UI.openModal(storeItem, imgUrl);
                } catch (err) {
                    console.error("Failed to mark item as purchased:", err);
                    alert("Failed to update item. Please try again.");
                    btnMarkPurchased.textContent = 'Mark as Purchased';
                    btnMarkPurchased.disabled = false;
                    btnMarkPurchased.style.opacity = '1';
                }
            });
        }

        const btnAddAltInline = document.getElementById('btn-add-alt-inline');
        if (btnAddAltInline) {
            btnAddAltInline.addEventListener('click', () => {
                modal.classList.add('hidden');
                window.pendingAlternativeParentId = item.id;
                document.getElementById('add-modal').classList.remove('hidden');
            });
        }

        // Attach click listeners to alternative items
        const altRows = document.querySelectorAll('.alt-item-row');
        altRows.forEach(row => {
            row.addEventListener('click', () => {
                const altId = row.getAttribute('data-alt-id');
                const altItem = Store.state.items.find(i => i.id === altId);
                if (altItem && UI.openComparisonModal) {
                    UI.openComparisonModal(item, altItem);
                }
            });
        });
        
        // Ensure close button uses new class
        let closeBtn = modal.querySelector('.close-button, .close-btn-atelier');
        if (closeBtn) {
            closeBtn.className = 'close-btn-atelier';
            closeBtn.onclick = () => modal.classList.add('hidden');
        }

        modal.classList.remove('hidden');
        
        window.onclick = (event) => {
            if (event.target === modal) modal.classList.add('hidden');
        };
    },
    openComparisonModal(mainItem, altItem) {
        // Hide standard item modal
        document.getElementById('item-modal').classList.add('hidden');

        // Main Item Setup
        const mainImgUrl = (mainItem.image_id && mainItem.image_id !== 'Unknown') ? 'https://lh3.googleusercontent.com/d/' + mainItem.image_id : 'https://via.placeholder.com/300x200';
        document.getElementById('compare-main-img').src = mainImgUrl;
        document.getElementById('compare-main-title').textContent = mainItem.name || 'Unnamed Item';

        const mainDisplayPrice = mainItem.actual_price ? mainItem.actual_price : mainItem.price;
        document.getElementById('compare-main-price').textContent = `₪${new Intl.NumberFormat('en-US').format(mainDisplayPrice || 0)}`;

        let mainDetails = '';
        if (mainItem.dim_l || mainItem.dim_w || mainItem.dim_h) {
            mainDetails += `<div>Dims: ${mainItem.dim_l || '-'} × ${mainItem.dim_w || '-'} × ${mainItem.dim_h || '-'} cm</div>`;
        }
        if (mainItem.store) {
            mainDetails += `<div>Store: ${mainItem.store}</div>`;
        }
        document.getElementById('compare-main-details').innerHTML = mainDetails;

        // Alternative Item Setup
        const altImgUrl = (altItem.image_id && altItem.image_id !== 'Unknown') ? 'https://lh3.googleusercontent.com/d/' + altItem.image_id : 'https://via.placeholder.com/300x200';
        document.getElementById('compare-alt-img').src = altImgUrl;
        document.getElementById('compare-alt-title').textContent = altItem.name || 'Unnamed Item';

        const altDisplayPrice = altItem.actual_price ? altItem.actual_price : altItem.price;
        document.getElementById('compare-alt-price').textContent = `₪${new Intl.NumberFormat('en-US').format(altDisplayPrice || 0)}`;

        let altDetails = '';
        if (altItem.dim_l || altItem.dim_w || altItem.dim_h) {
            altDetails += `<div>Dims: ${altItem.dim_l || '-'} × ${altItem.dim_w || '-'} × ${altItem.dim_h || '-'} cm</div>`;
        }
        if (altItem.store) {
            altDetails += `<div>Store: ${altItem.store}</div>`;
        }
        document.getElementById('compare-alt-details').innerHTML = altDetails;

        // Swap Logic (btn-select-primary)
        const selectPrimaryBtn = document.getElementById('btn-select-primary');
        // Clear previous event listeners using clone
        const newSelectBtn = selectPrimaryBtn.cloneNode(true);
        selectPrimaryBtn.parentNode.replaceChild(newSelectBtn, selectPrimaryBtn);

        // Swapping a paid item would remove its spending from the selected budget.
        if ([mainItem, altItem].some(item => String(item.is_purchased).toLowerCase() === 'true')) {
            newSelectBtn.disabled = true;
            newSelectBtn.textContent = 'Purchased option — review payment record before swapping';
        }

        newSelectBtn.addEventListener('click', async () => {
            newSelectBtn.textContent = 'Swapping...';
            newSelectBtn.disabled = true;

            try {
                // Preserve the priority of the furniture choice when selecting another option.
                const priority = String(mainItem.is_nice_to_have).toLowerCase() === 'true';
                await fetchAPI('updateItem', { item: { id: altItem.id, type: 'Main', parent_id: '', is_nice_to_have: priority } });

                // 2. Demote main to Alternative
                await fetchAPI('updateItem', { item: { id: mainItem.id, type: 'Alternative', parent_id: altItem.id } });

                // Update local store state
                altItem.type = 'Main';
                altItem.parent_id = '';
                altItem.is_nice_to_have = priority;

                mainItem.type = 'Alternative';
                mainItem.parent_id = altItem.id;

                // 3. Update any other alternatives that pointed to mainItem
                const otherAlts = Store.state.items.filter(item =>
                    String(item.type).toLowerCase() === 'alternative' && item.parent_id === mainItem.id
                );

                for (const otherAlt of otherAlts) {
                    await fetchAPI('updateItem', { item: { id: otherAlt.id, type: 'Alternative', parent_id: altItem.id } });
                    otherAlt.parent_id = altItem.id;
                }

                // Close the modal
                document.getElementById('comparison-modal').classList.add('hidden');

                Store.setState({ items: Store.state.items });

            } catch (err) {
                console.error("Error swapping items:", err);
                alert("Failed to swap items. Please check console for details.");
            } finally {
                newSelectBtn.textContent = 'Select as Primary ↗';
                newSelectBtn.disabled = false;
            }
        });

        // Show comparison modal
        const compModal = document.getElementById('comparison-modal');
        compModal.classList.remove('hidden');

        // Close button logic
        const closeBtn = document.getElementById('close-comparison-modal');
        closeBtn.onclick = () => compModal.classList.add('hidden');
        window.onclick = (event) => {
            if (event.target === compModal) compModal.classList.add('hidden');
        };
    },

    renderFinanceDashboard() {
        const container = document.getElementById('finance-details');
        if (!container) return;
        const { global, rooms, warnings } = Store.getBudgetStats();
        const format = value => '₪' + new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
        const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
        const roomLabel = name => name.replace(/([a-z])([A-Z])/g, '$1 $2');
        const row = (label, group, kind) => '<tr class="' + kind + '"><th scope="row">' + label + '</th><td>' + format(group.paid) + '</td><td class="remaining">' + format(group.remaining) + '</td><td>' + format(group.total) + '</td></tr>';
        const table = stats => '<div class="finance-table-wrap"><table class="finance-table"><thead><tr><th scope="col">Priority</th><th scope="col">Paid*</th><th scope="col">Left to spend</th><th scope="col">Expected total</th></tr></thead><tbody>' + row('Required', stats.required, 'required') + row('Nice to have', stats.optional, 'optional') + '</tbody><tfoot><tr><th scope="row">Combined</th><td>' + format(stats.spent) + '</td><td>' + format(stats.remaining) + '</td><td>' + format(stats.grandTotal) + '</td></tr></tfoot></table></div>';
        const missing = global.required.unpriced + global.optional.unpriced;
        const estimated = global.required.estimatedPaid + global.optional.estimatedPaid;
        container.innerHTML = '<p class="finance-intro">Your whole apartment · selected items only. Nice to have means optional.</p>' +
            '<div class="finance-highlights"><section class="finance-highlight required"><span>Required · left to spend</span><strong>' + format(global.required.remaining) + '</strong><small>To complete your essentials</small></section>' +
            '<section class="finance-highlight optional"><span>Nice to have · left to spend</span><strong>' + format(global.optional.remaining) + '</strong><small>Only if you choose to buy</small></section></div>' +
            '<section class="finance-summary"><h3>Apartment spending</h3>' + table(global) + '</section>' +
            '<p class="finance-note">*Paid treats purchased items as fully paid, using actual price when available. Remaining uses prices of unpurchased items; discounts on past purchases do not change it. Alternatives are excluded.</p>' +
            (estimated ? '<p class="finance-notice">' + estimated + ' purchased item(s) have no actual price. Their listed prices are used in Paid.</p>' : '') +
            (missing ? '<p class="finance-notice">' + missing + ' selected item(s) have missing or invalid prices. Totals are incomplete.</p>' : '') +
            (warnings.length ? '<details class="finance-notice" open><summary>Check purchase records (' + warnings.length + ')</summary><ul>' + warnings.map(warning => '<li>' + escape(warning) + '</li>').join('') + '</ul></details>' : '') +
            '<h3 class="finance-room-heading">Spending by room</h3><p class="finance-note">Rooms with the most required spending left appear first.</p><div class="finance-rooms">' +
            Object.entries(rooms).sort((a, b) => b[1].required.remaining - a[1].required.remaining || a[0].localeCompare(b[0])).map(([name, stats]) => '<section class="finance-room"><h4>' + escape(roomLabel(name)) + '</h4>' + (stats.required.count + stats.optional.count ? table(stats) : '<p class="finance-note">No selected items yet.</p>') + '</section>').join('') + '</div>' +
            (!global.required.count && !global.optional.count ? '<p class="finance-note">Add items to start planning your apartment spending.</p>' : '');
    },
};
