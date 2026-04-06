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
        const container = document.getElementById('carousel-container');

        if (!items || items.length === 0) {
            section.classList.add('hidden');
            return;
        }

        section.classList.remove('hidden');
        container.innerHTML = '';

        const sortedItems = [...items].sort((a, b) => {
            const aPurchased = a.is_purchased === true || String(a.is_purchased).toLowerCase() === 'true';
            const bPurchased = b.is_purchased === true || String(b.is_purchased).toLowerCase() === 'true';
            if (aPurchased !== bPurchased) return aPurchased ? 1 : -1;
            return (a.price || 0) - (b.price || 0);
        });

        sortedItems.forEach(item => {
            const isPurchased = item.is_purchased === true || String(item.is_purchased).toLowerCase() === 'true';
            const purchasedClass = isPurchased ? 'purchased' : '';
            
            // STRICT STRING CONCATENATION FOR IMAGE FIX
            const imgUrl = (item.image_id && item.image_id !== 'Unknown') ? 'https://drive.google.com/uc?export=view&id=' + item.image_id : 'https://via.placeholder.com/300x200';

            const card = document.createElement('div');
            card.className = `carousel-item ${purchasedClass}`;
            card.innerHTML = `
                <img src="${imgUrl}" alt="${item.name || 'Item'}">
                <div class="details">
                    <h3 style="margin: 0; font-size: 1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.name || 'Unnamed Item'}</h3>
                    <p style="margin: 4px 0; color: var(--primary-color); font-weight: bold;">₪${new Intl.NumberFormat('en-US').format(item.price || 0)}</p>
                </div>
            `;
            container.appendChild(card);
        });
    }
};
