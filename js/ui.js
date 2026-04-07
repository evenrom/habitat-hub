import { Store } from './store.js';
import { fetchAPI } from './api.js';

export const UI = {
    updateBudget(stats) {
        const formatCurrency = (val) => '₪' + new Intl.NumberFormat('en-US').format(val || 0);
        document.getElementById('budget-total').textContent = formatCurrency(stats.total);
        document.getElementById('budget-spent').textContent = formatCurrency(stats.spent);
        document.getElementById('budget-remaining').textContent = formatCurrency(stats.remaining);
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
        const hitboxes = document.querySelectorAll('.room-hitbox');
        const isMobile = window.matchMedia('(pointer: coarse)').matches;

        hitboxes.forEach(hitbox => {
            if (['path', 'rect', 'circle', 'polygon'].includes(hitbox.tagName.toLowerCase())) {
                hitbox.setAttribute('vector-effect', 'non-scaling-stroke');
            }
            const children = hitbox.querySelectorAll('*');
            children.forEach(child => {
                if (child.tagName.match(/^(path|rect|circle|polygon|line|polyline)$/i)) {
                    child.setAttribute('vector-effect', 'non-scaling-stroke');
                }
            });
        });

        hitboxes.forEach(hitbox => {
            hitbox.addEventListener('click', (e) => {
                e.preventDefault();
                const roomId = hitbox.getAttribute('data-room-id');

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
    },

    renderCarousel(items) {
        const section = document.getElementById('room-details');

        // Remove filtering out from Store, logic is now grouped and filtering depends on viewMode
        let mainItems = items.filter(item => String(item.type).toLowerCase() !== 'alternative');

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
                    <img src="${imgUrl}" alt="${item.name || 'Item'}">
                    <div class="details">
                        <h3 style="margin: 0; font-size: 1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.name || 'Unnamed Item'}</h3>
                        <p style="margin: 4px 0; color: var(--sage-green); font-weight: bold;">₪${new Intl.NumberFormat('en-US').format(item.price || 0)}</p>
                    </div>
                `;

                card.addEventListener('click', () => UI.openModal(item, imgUrl));

                container.appendChild(card);
            });
            rootContainer.appendChild(container);
        });
    },
    openModal(item, imgUrl) {
        const modal = document.getElementById('item-modal');
        document.getElementById('modal-image').src = imgUrl;
        document.getElementById('modal-title').textContent = item.name || 'Unnamed Item';
        
        // הגדרת מחיר (שימוש במחיר בפועל אם קיים)
        const displayPrice = item.actual_price ? item.actual_price : item.price;
        const priceLabel = item.actual_price ? 'PAID' : 'MSRP';
        
        document.getElementById('modal-price').innerHTML = `
            <span style="font-size: 10px; color: var(--text-secondary); vertical-align: middle; margin-right: 8px;">${priceLabel}</span>
            ₪${new Intl.NumberFormat('en-US').format(displayPrice || 0)}
        `;
        
        // הרכבת אזור המפרט הטכני (Dimensions & Store)
        let detailsHtml = `<div style="margin-top: 24px; display: flex; flex-direction: column; gap: 16px;">`;
        
        // שורת חנות ולינק
        if (item.store || item.product_url) {
            detailsHtml += `
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-light); padding-bottom: 12px;">
                <span style="color: var(--text-secondary); font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase;">Vendor / Store</span>
                <a href="${item.product_url || '#'}" target="_blank" style="color: var(--sage-green); text-decoration: none; font-weight: 600; font-size: 14px;">
                    ${item.store || 'View Store'} ↗
                </a>
            </div>`;
        }

        // שורת מידות
        if (item.dim_l || item.dim_w || item.dim_h) {
            detailsHtml += `
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-light); padding-bottom: 12px;">
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
                <div style="margin-top: 24px; border-top: 1px solid var(--border-light); padding-top: 16px;">
                    <span style="color: var(--text-secondary); font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase;">Curated Alternatives (${alternatives.length})</span>
                    <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 12px;">`;
                
                alternatives.forEach(alt => {
                    const altPrice = alt.actual_price ? alt.actual_price : alt.price;
                    detailsHtml += `
                        <div class="alt-item-row" data-alt-id="${alt.id}" style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-light); border-radius: 8px; padding: 12px; display: flex; justify-content: space-between; align-items: center; transition: background 0.2s; cursor: pointer;" onmouseover="this.style.background='rgba(255,255,255,0.06)'" onmouseout="this.style.background='rgba(255,255,255,0.02)'">
                            <div>
                                <div style="font-size: 13px; font-weight: 600; color: var(--text-primary);">${alt.name || 'Alternative Option'}</div>
                                <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">${alt.store || 'Unknown Store'}</div>
                            </div>
                            <div style="color: var(--sage-green); font-weight: bold; font-size: 14px;">
                                ₪${new Intl.NumberFormat('en-US').format(altPrice || 0)}
                            </div>
                        </div>`;
                });
                
                detailsHtml += `</div></div>`;
            }
        }

        detailsHtml += `<button id="btn-add-alt-inline" style="width: 100%; margin-top: 16px; background: transparent; border: 1px dashed var(--sage-green); color: var(--sage-green); padding: 10px; border-radius: 8px; cursor: pointer;">+ Add Alternative</button>`;
        detailsHtml += `</div>`;
        document.getElementById('modal-details').innerHTML = detailsHtml;

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
        
        modal.classList.remove('hidden');
        
        // מנגנון סגירה
        const closeBtn = modal.querySelector('.close-button');
        closeBtn.onclick = () => modal.classList.add('hidden');
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
                // 1. Promote alt to Main
                await fetchAPI('updateItem', { item: { id: altItem.id, type: 'Main', parent_id: '' } });

                // 2. Demote main to Alternative
                await fetchAPI('updateItem', { item: { id: mainItem.id, type: 'Alternative', parent_id: altItem.id } });

                // Update local store state
                altItem.type = 'Main';
                altItem.parent_id = '';

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

        // חישוב הוצאות לפי חדר
        const roomStats = {};
        items.forEach(item => {
            if (String(item.type).toLowerCase() === 'alternative') return;
            
            const room = item.room || 'Unassigned';
            if (!roomStats[room]) roomStats[room] = { estimated: 0, spent: 0 };
            
            const isPurchased = item.is_purchased === true || String(item.is_purchased).toLowerCase() === 'true';
            const price = Number(item.price) || 0;
            const actualPrice = item.actual_price !== undefined ? Number(item.actual_price) : price;

            roomStats[room].estimated += price;
            if (isPurchased) {
                roomStats[room].spent += actualPrice;
            }
        });

        let html = '<div style="display: flex; flex-direction: column; gap: 16px;">';
        
        for (const [room, stats] of Object.entries(roomStats)) {
            const percent = stats.estimated > 0 ? Math.min((stats.spent / stats.estimated) * 100, 100) : 0;
            const remaining = Math.max(0, stats.estimated - stats.spent);
            
            html += `
            <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-light); border-radius: 8px; padding: 16px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                    <strong style="font-size: 14px; color: var(--text-primary); text-transform: uppercase; letter-spacing: 0.05em;">${room}</strong>
                    <span style="font-size: 12px; color: var(--text-secondary);">Est: ₪${new Intl.NumberFormat('en-US').format(stats.estimated)}</span>
                </div>
                <div style="width: 100%; background: rgba(0,0,0,0.5); height: 6px; border-radius: 3px; overflow: hidden; margin-bottom: 12px;">
                    <div style="width: ${percent}%; height: 100%; background: var(--sage-green); transition: width 0.5s ease-out;"></div>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 13px;">
                    <span style="color: var(--sage-green); font-weight: 600;">Spent: ₪${new Intl.NumberFormat('en-US').format(stats.spent)}</span>
                    <span style="color: var(--text-secondary);">Remaining: ₪${new Intl.NumberFormat('en-US').format(remaining)}</span>
                </div>
            </div>`;
        }
        
        html += '</div>';
        container.innerHTML = html;
    }
};
