const imgUrl = item.image_id ? 'https://lh3.googleusercontent.com/u/0/d/$' + item.image_id + '=s400-c' : 'https://via.placeholder.com/300x200';

// Assuming this is how initMapEvents and renderCarousel should be updated:

function initMapEvents() {
    const svgChildren = document.querySelectorAll('svg > *'); // Select all SVG children
    svgChildren.forEach(child => {
        child.style.vectorEffect = 'non-scaling-stroke';
    });
}

function renderCarousel(items) {
    // Sort items by price
    items.sort((a, b) => a.price - b.price);
    // Move purchased items to the end
    const purchasedItems = items.filter(item => item.is_purchased);
    const unpurchasedItems = items.filter(item => !item.is_purchased);
    const sortedItems = [...unpurchasedItems, ...purchasedItems];
    sortedItems.forEach(item => {
        // Logic to render items goes here...
        // Apply 'purchased' class if the item is purchased
        if (item.is_purchased) {
            // e.g., itemElement.classList.add('purchased');
        }
    });
}