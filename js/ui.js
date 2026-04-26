import { Store } from './store.js';
import { fetchAPI } from './api.js';

export const UI = {
    lazyLoadObserver: null,

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
        // Deprecated: Budget display moved to the Finance Dashboard modal.
        return;
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
        const isMobile = window.matchMedia('(pointer: coarse)').matches;

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

                if (isMobile) {
                    if (hitbox.classList.contains('selected') || hitbox.classList.contains('active')) {
                        hitbox.classList.remove('selected', 'active');
                        onRoomSelect(roomId);
                    } else {
                        hitboxes.forEach(hb => hb.classList.remove('selected', 'active'));
                        hitbox.classList.add('selected', 'active');
                    }
                } else {
                    onRoomSelect(roomId);
                }
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
                    const mainItems = Store.state.items.filter(item => String(item.type).toLowerCase() !== 'alternative');
                    UI.renderCarousel(mainItems);
                }
            });
        }
    },

    renderCarousel(items) {
        const section = document.getElementById('room-details');

        // Remove filtering out from Store, logic is now grouped and filtering depends on viewMode
        let mainItems = (items || []).filter(item => item && item.id && item.name && String(item.type).toLowerCase() !== 'alternative');
        
        // Task 4: Global Core Filter
        if (Store.state.coreOnly) {
            mainItems = mainItems.filter(item => String(item.is_nice_to_have).toLowerCase() !== 'true');
        }

        if (!mainItems || mainItems.length === 0) {
            section.classList.add('hidden');
            return;
        }

        section.classList.remove('hidden');

        let groups = {};

        if (Store.state.viewMode === 'rooms') {
            if (Store.state.currentRoom && Store.state.currentRoom !== 'All') {
                mainItems = mainItems.filter(item => item.room === Store.state.currentRoom);
            }
            mainItems.forEach(item => {
                const groupName = item.room || 'Unassigned';
                if (!groups[groupName]) groups[groupName] = [];
                groups[groupName].push(item);
            });
        } else if (Store.state.viewMode === 'stores') {
            mainItems.forEach(item => {
                const groupName = item.store || 'Unassigned';
                if (!groups[groupName]) groups[groupName] = [];
                groups[groupName].push(item);
            });
        }

        // Target 'room-details'. Clear innerHTML since we will build headers + carousels dynamically.
        // Also add the original container id to avoid changing the HTML layout.
        section.innerHTML = '<h2>Selected Products</h2><div id="carousel-container" style="display: flex; flex-direction: column; gap: 0;"></div>';
        const rootContainer = document.getElementById('carousel-container');

        if (Object.keys(groups).length === 0) {
             section.classList.add('hidden');
             return;
        }

        Object.keys(groups).forEach(groupName => {
            const groupItems = groups[groupName];
            
            const groupHeader = document.createElement('h2');
            groupHeader.style.cssText = 'margin-top: 32px; font-size: 16px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.1em;';
            groupHeader.textContent = groupName;
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

                card.innerHTML = `
                    <img data-src="${imgUrl}" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" alt="${item.name || 'Item'}">
                    <div class="details">
                        <h3 style="margin: 0; font-size: 1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.name || 'Unnamed Item'}</h3>
                        <p style="margin: 4px 0; color: #adab9e; font-weight: bold;">₪${new Intl.NumberFormat('en-US').format(item.price || 0)}</p>
                    </div>
                `;

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

                // Open the modal on Step 2
                document.getElementById('add-step-1').classList.add('hidden');
                document.getElementById('add-step-2').classList.remove('hidden');
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

        newSelectBtn.addEventListener('click', async () => {
            newSelectBtn.textContent = 'Swapping...';
            newSelectBtn.disabled = true;

            try {
                // 1. Promote alt to Main (and forcefully set is_nice_to_have to false)
                await fetchAPI('updateItem', { item: { id: altItem.id, type: 'Main', parent_id: '', is_nice_to_have: false } });

                // 2. Demote main to Alternative
                await fetchAPI('updateItem', { item: { id: mainItem.id, type: 'Alternative', parent_id: altItem.id } });

                // Update local store state
                altItem.type = 'Main';
                altItem.parent_id = '';
                altItem.is_nice_to_have = false;

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

                // Trigger render with current room/store filters
                const filteredItems = Store.state.items.filter(item => {
                    const roomMatch = !Store.state.currentRoom || item.room === Store.state.currentRoom;
                    const storeMatch = Store.state.currentStore === 'All' || item.store === Store.state.currentStore;
                    return roomMatch && storeMatch;
                });

                UI.renderCarousel(filteredItems);
                UI.updateBudget(Store.getBudgetStats());

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

    renderFinanceDashboard(items) {
        const container = document.getElementById('finance-details');
        if (!container) return;

        const budgetStats = Store.getBudgetStats();
        const global = budgetStats.global;
        const rooms = budgetStats.rooms;
        
        let html = '<div style="display: flex; flex-direction: column; gap: 24px;">';

        // --- Global Stats ---
        const globalPercent = global.grandTotal > 0 ? Math.min((global.spent / global.grandTotal) * 100, 100) : 0;
        
        html += `
        <div style="background: rgba(23, 19, 15, 0.8); border: 1px solid var(--actions); border-radius: 8px; padding: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
            <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                <strong style="font-size: 18px; color: var(--text-primary); text-transform: uppercase; letter-spacing: 0.1em; font-family: var(--font-headings);">Global Budget</strong>
                <span style="font-size: 16px; color: var(--actions); font-weight: 700; font-family: var(--font-main);">Est: ₪${new Intl.NumberFormat('en-US').format(global.grandTotal)}</span>
            </div>
            <div style="width: 100%; background: rgba(0,0,0,0.5); height: 10px; border-radius: 5px; overflow: hidden; margin-bottom: 16px;">
                <div style="width: ${globalPercent}%; height: 100%; background: var(--actions); transition: width 0.5s ease-out;"></div>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 14px; font-family: var(--font-main); margin-bottom: 8px;">
                <span style="color: var(--text-primary); font-weight: 600;">Spent: ₪${new Intl.NumberFormat('en-US').format(global.spent)}</span>
                <span style="color: #adab9e;">Remaining: ₪${new Intl.NumberFormat('en-US').format(global.grandTotal - global.spent)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 13px; font-family: var(--font-main); border-top: 1px solid rgba(173, 171, 158, 0.2); padding-top: 8px;">
                <span style="color: #adab9e;">Core: ₪${new Intl.NumberFormat('en-US').format(global.coreTotal)}</span>
                <span style="color: #adab9e;">Nice-to-have: ₪${new Intl.NumberFormat('en-US').format(global.niceToHaveTotal)}</span>
            </div>
        </div>
        
        <h3 style="font-family: var(--font-headings); font-size: 16px; color: var(--text-primary); margin: 0 0 -8px 0; border-bottom: 1px solid rgba(173, 171, 158, 0.2); padding-bottom: 8px;">Per-Room Breakdown</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 12px;">
        `;

        // --- Room Breakdowns ---
        for (const roomName in rooms) {
            const r = rooms[roomName];
            const roomPercent = r.roomTotal > 0 ? Math.min((r.spent / r.roomTotal) * 100, 100) : 0;
            
            html += `
            <div style="background: rgba(41, 36, 32, 0.6); border: 1px solid rgba(173, 171, 158, 0.15); border-radius: 8px; padding: 12px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <strong style="font-size: 14px; color: var(--text-primary); font-family: var(--font-headings);">${roomName}</strong>
                    <span style="font-size: 13px; color: var(--actions); font-weight: 600;">₪${new Intl.NumberFormat('en-US').format(r.roomTotal)}</span>
                </div>
                <div style="width: 100%; background: rgba(0,0,0,0.5); height: 6px; border-radius: 3px; overflow: hidden; margin-bottom: 8px;">
                    <div style="width: ${roomPercent}%; height: 100%; background: var(--actions);"></div>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 12px; font-family: var(--font-main);">
                    <span style="color: #adab9e;">Core: ₪${new Intl.NumberFormat('en-US').format(r.coreTotal)}</span>
                    <span style="color: #adab9e;">Nice: ₪${new Intl.NumberFormat('en-US').format(r.niceToHaveTotal)}</span>
                </div>
            </div>`;
        }

        html += '</div></div>';
        container.innerHTML = html;
    },
};
