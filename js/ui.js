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
                    // 1. Extract intrinsic dimensions (fallback to 18500x20613 if missing)
                    const w = parseFloat(svgElement.getAttribute('width')) || 18500;
                    const h = parseFloat(svgElement.getAttribute('height')) || 20613;

                    // 2. Force responsive viewBox
                    if (!svgElement.getAttribute('viewBox')) {
                        svgElement.setAttribute('viewBox', `0 0 ${w} ${h}`);
                    }

                    // 3. Strip hardcoded absolute constraints
                    svgElement.removeAttribute('width');
                    svgElement.removeAttribute('height');

                    // 4. Force CSS scaling priority
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
            hitbox.addEventListener('click', (e) => {
                e.preventDefault(); // Prevent double firing on touch devices

                const roomId = hitbox.getAttribute('data-room-id');

                if (isMobile) {
                    if (hitbox.classList.contains('active')) {
                        // 2nd Tap
                        hitbox.classList.remove('active');
                        onRoomSelect(roomId);
                    } else {
                        // 1st Tap
                        hitboxes.forEach(hb => hb.classList.remove('active')); // Reset others
                        hitbox.classList.add('active');
                        // Show tooltip could go here
                    }
                } else {
                    // Desktop immediately triggers
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

        // Sort items: purchased items at the end
        const sortedItems = [...items].sort((a, b) => {
            const aPurchased = a.is_purchased === true || String(a.is_purchased).toLowerCase() === 'true';
            const bPurchased = b.is_purchased === true || String(b.is_purchased).toLowerCase() === 'true';
            return (aPurchased === bPurchased) ? 0 : aPurchased ? 1 : -1;
        });

        sortedItems.forEach(item => {
            const isPurchased = item.is_purchased === true || String(item.is_purchased).toLowerCase() === 'true';
            const purchasedClass = isPurchased ? 'purchased' : '';

            // Assume 1:1 drive thumbnails, crop to 3:2 via css
            const imgUrl = item.imageID ? `https://lh3.googleusercontent.com/d/${item.imageID}=w400` : 'https://via.placeholder.com/300x200';

            const card = document.createElement('div');
            card.className = `carousel-item ${purchasedClass}`;

            card.innerHTML = `
                <img src="${imgUrl}" alt="${item.name || 'Item'}">
                <div class="details">
                    <h3 style="margin: 0; font-size: 1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.name || 'Unnamed Item'}</h3>
                    <p style="margin: 4px 0; color: var(--primary-color); font-weight: bold;">₪${item.price || 0}</p>
                </div>
            `;
            container.appendChild(card);
        });
    }
};