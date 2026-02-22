// Environment & Config
const BACKEND_URL = 'https://script.google.com/macros/s/AKfycbw2_7k7c56NCnOegNaJYgjFYvTF9hRCEr1EEcvnWBYE2kaHSwGq_f1kGNX3Haiqsbej/exec';
const PASSCODE = 'SA8RG';
const CONFIG = {
    themeKey: 'habitat_theme',
    floorPlanImg: 'https://via.placeholder.com/2000x1500.png?text=Floor+Plan+High+Res' // Placeholder, in real app this would be configurable
};

// State
const store = {
    rooms: [], // ['Kitchen', 'Living Room'...]
    items: [], // [{ id, room, type, name, price... }]
    currentRoom: null,
    cropper: null,
    tempImageBlob: null,
    tempAnalysisData: null
};

// DOM Elements
const els = {
    app: document.getElementById('app'),
    themeToggle: document.getElementById('theme-toggle'),
    views: {
        rooms: document.getElementById('view-rooms'),
        roomDetail: document.getElementById('view-room-detail'),
        floorplan: document.getElementById('view-floorplan'),
        budget: document.getElementById('view-budget')
    },
    navItems: document.querySelectorAll('.nav-item'),
    roomList: document.getElementById('room-list-container'),
    roomDetailName: document.getElementById('room-detail-name'),
    roomItemsList: document.getElementById('room-items-container'),
    backToRooms: document.getElementById('back-to-rooms'),
    fabAdd: document.getElementById('fab-add-item'),
    modals: {
        add: document.getElementById('modal-add-item'),
        validation: document.getElementById('modal-validation')
    },
    addItemForm: {
        form: document.getElementById('add-item-form'),
        title: document.getElementById('item-title-input'),
        fileInput: document.getElementById('image-upload-input'),
        cropperContainer: document.getElementById('cropper-container'),
        imgToCrop: document.getElementById('image-to-crop'),
        url: document.getElementById('item-url-input'),
        analyzeBtn: document.getElementById('btn-analyze')
    },
    validationForm: {
        container: document.getElementById('validation-form'),
        loader: document.getElementById('loading-indicator'),
        preview: document.getElementById('val-img-preview'),
        name: document.getElementById('val-name'),
        price: document.getElementById('val-price'),
        dimL: document.getElementById('val-dim-l'),
        dimW: document.getElementById('val-dim-w'),
        dimH: document.getElementById('val-dim-h'),
        analysis: document.getElementById('val-analysis'),
        saveBtn: document.getElementById('btn-save-item')
    },
    budgetTotal: document.getElementById('budget-total'),
    budgetList: document.getElementById('budget-list-container'),
    panzoomEl: document.getElementById('panzoom-element')
};

// -----------------------------------------------------------------------------
// Initialization
// -----------------------------------------------------------------------------

async function init() {
    setupTheme();
    setupNavigation();
    setupPanzoom();
    setupEventListeners();

    // Initial Data Fetch
    await fetchInitialData();
}

// -----------------------------------------------------------------------------
// Theme Management
// -----------------------------------------------------------------------------

function setupTheme() {
    const storedTheme = localStorage.getItem(CONFIG.themeKey);
    if (storedTheme) {
        document.documentElement.setAttribute('data-theme', storedTheme);
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.setAttribute('data-theme', 'dark');
    }

    els.themeToggle.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem(CONFIG.themeKey, next);
    });
}

// -----------------------------------------------------------------------------
// API Service
// -----------------------------------------------------------------------------

async function apiCall(action, payload = {}) {
    const body = {
        passcode: PASSCODE,
        action: action,
        ...payload
    };

    try {
        const response = await fetch(BACKEND_URL, {
            method: 'POST',
            body: JSON.stringify(body), // GAS requires stringified body for text/plain (no CORS preflight usually needed if simple, but here we use POST)
            // Note: GAS `doPost` often needs 'Content-Type': 'text/plain;charset=utf-8' to avoid CORS preflight issues with application/json
            // However, modern fetch might handle it. Best practice for GAS is often no-cors or text/plain.
            // Let's try standard first, if fails we adjust.
            // Actually, for GAS Web App to return JSON, we often use redirect.
            // Standard approach: Send as text/plain to avoid CORS strictness if on different domain.
            headers: {
                'Content-Type': 'text/plain;charset=utf-8'
            }
        });

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }
        return data;
    } catch (error) {
        console.error('API Error:', error);
        showToast('Error: ' + error.message);
        return null;
    }
}

async function fetchInitialData() {
    // Show skeletons
    els.roomList.innerHTML = '<div class="skeleton-loader-room"></div>'.repeat(4);

    const data = await apiCall('getInitialData');
    if (data) {
        store.rooms = data.rooms || [];
        store.items = data.items || [];
        renderRoomList();
        renderBudget();
    }
}

// -----------------------------------------------------------------------------
// Navigation & Views
// -----------------------------------------------------------------------------

function setupNavigation() {
    // Bottom Nav
    els.navItems.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetId = btn.getAttribute('data-target');
            switchView(targetId);

            // Update Active State
            els.navItems.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    // Back Button (Detail -> Rooms)
    els.backToRooms.addEventListener('click', () => {
        switchView('view-rooms');
        store.currentRoom = null;
    });
}

function switchView(viewId) {
    Object.values(els.views).forEach(el => {
        el.classList.remove('active');
        el.classList.add('hidden'); // Ensure hidden class is applied
        // Wait, styles.css uses .view { display: none } and .active { display: block }.
        // .hidden is !important display: none.
        // Let's rely on .active toggle logic mainly.
        // Actually, CSS says .view is display:none, .view.active is display:block.
        // So just toggling active is enough.
        // BUT, room-detail is special, it's not in nav.
        if (viewId === 'view-rooms' && el.id === 'view-room-detail') return; // Don't mess with detail if going to rooms? No, hide detail.
    });

    // Reset logic
    document.querySelectorAll('.view').forEach(v => {
        v.classList.remove('active');
        // v.classList.add('hidden'); // Optional if CSS handles it
    });

    const target = document.getElementById(viewId);
    if (target) {
        target.classList.add('active');
        target.classList.remove('hidden');
    }

    // Special case for Floor Plan to resize panzoom
    if (viewId === 'view-floorplan') {
        // Trigger resize event or similar if needed
    }

    // Special Refresh for Budget
    if (viewId === 'view-budget') {
        renderBudget();
    }
}

// -----------------------------------------------------------------------------
// Room & Item Rendering
// -----------------------------------------------------------------------------

function renderRoomList() {
    els.roomList.innerHTML = '';

    if (store.rooms.length === 0) {
        els.roomList.innerHTML = '<p>No rooms found.</p>';
        return;
    }

    store.rooms.forEach(roomName => {
        const card = document.createElement('div');
        card.className = 'room-card';
        card.innerHTML = `
            <div class="room-icon"><span class="material-icons-round">meeting_room</span></div>
            <h3>${roomName}</h3>
            <p class="count">${countItemsInRoom(roomName)} Items</p>
        `;
        card.addEventListener('click', () => openRoomDetail(roomName));
        els.roomList.appendChild(card);
    });
}

function countItemsInRoom(roomName) {
    return store.items.filter(i => i.Room === roomName && i.Type === 'Main').length;
}

function openRoomDetail(roomName) {
    store.currentRoom = roomName;
    els.roomDetailName.textContent = roomName;
    renderRoomItems(roomName);

    // Hide Rooms View, Show Detail View
    els.views.rooms.classList.remove('active');
    els.views.roomDetail.classList.remove('hidden');
    els.views.roomDetail.classList.add('active');
}

function renderRoomItems(roomName) {
    const container = els.roomItemsList;
    container.innerHTML = '';

    const roomItems = store.items.filter(i => i.Room === roomName);
    const mainItems = roomItems.filter(i => i.Type === 'Main');

    if (mainItems.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding:20px; color:#999;">No items yet. Tap + to add.</p>';
        return;
    }

    mainItems.forEach(mainItem => {
        const itemEl = createItemElement(mainItem, roomItems);
        container.appendChild(itemEl);
    });
}

function createItemElement(mainItem, allRoomItems) {
    const alternatives = allRoomItems.filter(i => i.ParentID === mainItem.ID && i.Type === 'Alternative');

    const div = document.createElement('div');
    div.className = 'item-card';

    // Main Item HTML
    // We need a way to get image URL. Assuming Google Drive ID logic or direct URL.
    // If it's a Drive ID (from backend), we need a proxy or thumbnail link.
    // GAS backend returns imageID. Drive thumbnail: https://lh3.googleusercontent.com/d/ID=w200
    // Prompt says: "ImageID" in sheet.

    const imgUrl = mainItem.ImageID ? `https://lh3.googleusercontent.com/d/${mainItem.ImageID}=w200` : 'https://via.placeholder.com/80';

    let html = `
        <div class="item-main">
            <img src="${imgUrl}" class="item-img" alt="${mainItem.Name}">
            <div class="item-info">
                <div class="item-title">${mainItem.Name}</div>
                <div class="item-price">₪${mainItem.Price ? Number(mainItem.Price).toLocaleString() : '0'}</div>
                <div class="item-dims">${mainItem.Dim_L || '?'} x ${mainItem.Dim_W || '?'} x ${mainItem.Dim_H || '?'}</div>
            </div>
            ${mainItem.ProductURL ? `<a href="${mainItem.ProductURL}" target="_blank" class="material-icons-round" style="color:var(--color-secondary); text-decoration:none;">link</a>` : ''}
        </div>
    `;

    // Alternatives Accordion
    if (alternatives.length > 0 || true) { // Always show accordion capability? Or only if alts exist?
        // To allow adding alternatives easily, maybe we need an "Add Alternative" button inside?
        // PRD says: "Each main item can have Options/Alternatives... displayed in an accordion".
        // Let's render alts if they exist.

        html += `
            <div class="accordion-header" onclick="toggleAccordion(this)">
                <span>Alternatives (${alternatives.length})</span>
                <span class="material-icons-round">expand_more</span>
            </div>
            <div class="accordion-body">
                ${alternatives.map(alt => {
                    const altImg = alt.ImageID ? `https://lh3.googleusercontent.com/d/${alt.ImageID}=w80` : 'https://via.placeholder.com/40';
                    return `
                    <div class="alt-item">
                        <img src="${altImg}" style="width:40px;height:40px;border-radius:4px;margin-right:8px;object-fit:cover;">
                        <div style="flex:1;">
                            <div style="font-size:0.9rem;font-weight:600;">${alt.Name}</div>
                            <div style="font-size:0.8rem;">₪${Number(alt.Price).toLocaleString()}</div>
                        </div>
                        <button class="btn-set-main" onclick="swapMainItem('${mainItem.ID}', '${alt.ID}')">Set Main</button>
                    </div>
                    `;
                }).join('')}
                <button class="btn-add-alt" onclick="initAddAlternative('${mainItem.ID}')" style="width:100%; padding:8px; margin-top:8px; background:none; border:1px dashed #ccc; border-radius:4px; cursor:pointer;">+ Add Alternative</button>
            </div>
        `;
    }

    div.innerHTML = html;
    return div;
}

window.toggleAccordion = function(header) {
    const body = header.nextElementSibling;
    const icon = header.querySelector('.material-icons-round');
    if (body.classList.contains('open')) {
        body.classList.remove('open');
        icon.textContent = 'expand_more';
    } else {
        body.classList.add('open');
        icon.textContent = 'expand_less';
    }
}

// -----------------------------------------------------------------------------
// Logic: Swap Main & Alternative
// -----------------------------------------------------------------------------

window.swapMainItem = async function(mainId, altId) {
    // Optimistic UI Update? Or Wait?
    // Let's find objects
    const mainItem = store.items.find(i => i.ID === mainId);
    const altItem = store.items.find(i => i.ID === altId);

    if (!mainItem || !altItem) return;

    if (!confirm(`Swap "${altItem.Name}" to be the Main item?`)) return;

    showToast('Swapping items...');

    // 1. Update Local State
    mainItem.Type = 'Alternative';
    mainItem.ParentID = altId; // Wait, if we swap, the new main becomes the parent ID for the old main?
    // Actually, usually ParentID is the ID of the *Current* Main.
    // So:
    // Old Main becomes Alternative. Its ParentID -> New Main ID.
    // New Main (Old Alt) becomes Main. Its ParentID -> Empty.
    // Siblings (Other Alts) -> Their ParentID must update to New Main ID.

    const siblings = store.items.filter(i => i.ParentID === mainId && i.ID !== altId);

    // Updates to send to backend
    // We need to update: Old Main, New Main, All Siblings.
    // This is complex for a single API call if not batched.
    // The backend `updateItem` handles one item.
    // We might need to make multiple calls or a `batchUpdate` endpoint.
    // Given the constraints, let's just do it sequentially or (better) add batch support to backend.
    // But I can't change backend now (I am frontend dev in this turn).
    // I will loop calls.

    // Logic:
    // 1. New Main: Type='Main', ParentID=''
    // 2. Old Main: Type='Alternative', ParentID=NewMain.ID
    // 3. Siblings: ParentID=NewMain.ID

    const newMainId = altItem.ID;

    // Local Updates
    altItem.Type = 'Main';
    altItem.ParentID = '';

    mainItem.Type = 'Alternative';
    mainItem.ParentID = newMainId;

    siblings.forEach(s => s.ParentID = newMainId);

    renderRoomItems(store.currentRoom);
    renderBudget();

    // API Sync
    try {
        await apiCall('updateItem', { item: { id: altItem.ID, type: 'Main', parentID: '' } });
        await apiCall('updateItem', { item: { id: mainItem.ID, type: 'Alternative', parentID: newMainId } });
        for (const sib of siblings) {
            await apiCall('updateItem', { item: { id: sib.ID, parentID: newMainId } });
        }
        showToast('Swap complete & saved.');
    } catch (e) {
        showToast('Error syncing swap: ' + e.message);
        // In real app, revert state here
    }
}

// -----------------------------------------------------------------------------
// Add Item Flow
// -----------------------------------------------------------------------------

let isAddingAlternative = false;
let targetParentId = null;

// FAB Click
els.fabAdd.addEventListener('click', () => {
    isAddingAlternative = false;
    targetParentId = null;
    openAddModal();
});

window.initAddAlternative = function(parentId) {
    isAddingAlternative = true;
    targetParentId = parentId;
    openAddModal();
}

function openAddModal() {
    // Reset Form
    els.addItemForm.form.reset();
    els.addItemForm.cropperContainer.classList.add('hidden');
    els.addItemForm.analyzeBtn.disabled = true;
    if (store.cropper) {
        store.cropper.destroy();
        store.cropper = null;
    }

    const modalTitle = els.modals.add.querySelector('h3');
    modalTitle.textContent = isAddingAlternative ? 'Add Alternative Option' : 'Add New Item';

    els.modals.add.classList.add('visible'); // visible class for opacity
    // Also remove hidden class if using both logic
    els.modals.add.style.display = 'flex'; // Ensure flex
}

// Close Modals
document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal');
        modal.classList.remove('visible');
        setTimeout(() => modal.style.display = 'none', 300);
    });
});

// Image Upload & Cropper
els.addItemForm.fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (evt) => {
            els.addItemForm.imgToCrop.src = evt.target.result;
            els.addItemForm.cropperContainer.classList.remove('hidden');

            if (store.cropper) store.cropper.destroy();
            store.cropper = new Cropper(els.addItemForm.imgToCrop, {
                aspectRatio: NaN, // Free crop
                viewMode: 1,
            });
            els.addItemForm.analyzeBtn.disabled = false;
        };
        reader.readAsDataURL(file);
    }
});

// Analyze Button
els.addItemForm.analyzeBtn.addEventListener('click', async () => {
    if (!store.cropper) return;

    // Get cropped canvas
    const canvas = store.cropper.getCroppedCanvas({
        width: 600, // Reasonable size for API
        height: 600
    });

    const base64Image = canvas.toDataURL('image/png');

    // Close Add Modal, Open Validation Modal (Loading State)
    els.modals.add.classList.remove('visible');
    setTimeout(() => els.modals.add.style.display = 'none', 300);

    openValidationModal(base64Image);
});

async function openValidationModal(base64Image) {
    els.modals.validation.style.display = 'flex';
    // Force reflow
    els.modals.validation.offsetHeight;
    els.modals.validation.classList.add('visible');

    els.validationForm.loader.classList.remove('hidden');
    els.validationForm.container.classList.add('hidden');

    // Call API
    const result = await apiCall('analyzeAndUpload', { base64Image: base64Image });

    if (result && result.success) {
        populateValidationForm(result.extractedData, result.imageID, base64Image);
    } else {
        showToast('Analysis failed.');
        els.modals.validation.classList.remove('visible');
    }
}

function populateValidationForm(data, imageID, previewBase64) {
    els.validationForm.loader.classList.add('hidden');
    els.validationForm.container.classList.remove('hidden');

    els.validationForm.preview.src = previewBase64;

    // Pre-fill
    els.validationForm.name.value = data.name || els.addItemForm.title.value || '';
    els.validationForm.price.value = data.price || '';
    els.validationForm.dimL.value = data.dim_l || '';
    els.validationForm.dimW.value = data.dim_w || '';
    els.validationForm.dimH.value = data.dim_h || '';
    els.validationForm.analysis.value = JSON.stringify(data.image_analysis || {}, null, 2);

    // Store temp data needed for save
    store.tempSaveData = {
        imageID: imageID,
        productURL: els.addItemForm.url.value
    };
}

// Save Item (Final Step)
els.validationForm.container.addEventListener('submit', async (e) => {
    e.preventDefault();

    const newItem = {
        room: store.currentRoom,
        type: isAddingAlternative ? 'Alternative' : 'Main',
        parentID: targetParentId || '',
        name: els.validationForm.name.value,
        price: Number(els.validationForm.price.value),
        dim_l: els.validationForm.dimL.value,
        dim_w: els.validationForm.dimW.value,
        dim_h: els.validationForm.dimH.value,
        imageID: store.tempSaveData.imageID,
        productURL: store.tempSaveData.productURL
    };

    showToast('Saving item...');

    const result = await apiCall('saveItem', { item: newItem });

    if (result && result.success) {
        showToast('Item saved!');

        // Add to local store optimistically or re-fetch?
        // Re-fetching is safer for ID sync.
        await fetchInitialData();

        // Close Modal
        els.modals.validation.classList.remove('visible');
        setTimeout(() => els.modals.validation.style.display = 'none', 300);

        // Return to detail view
        if (store.currentRoom) {
            renderRoomItems(store.currentRoom);
        }
    }
});

// -----------------------------------------------------------------------------
// Floor Plan
// -----------------------------------------------------------------------------

function setupPanzoom() {
    // Wait for image load
    const img = els.panzoomEl.querySelector('img');
    // Using Panzoom library
    const pz = Panzoom(els.panzoomEl, {
        maxScale: 5,
        contain: 'outside'
    });

    els.panzoomEl.parentElement.addEventListener('wheel', pz.zoomWithWheel);
}

function setupEventListeners() {
    // Any global listeners
}

// -----------------------------------------------------------------------------
// Budget Logic
// -----------------------------------------------------------------------------

function renderBudget() {
    const mainItems = store.items.filter(i => i.Type === 'Main');
    const total = mainItems.reduce((sum, item) => sum + (Number(item.Price) || 0), 0);

    els.budgetTotal.textContent = '₪' + total.toLocaleString();

    // Breakdown
    els.budgetList.innerHTML = '';

    store.rooms.forEach(room => {
        const roomTotal = store.items
            .filter(i => i.Room === room && i.Type === 'Main')
            .reduce((sum, item) => sum + (Number(item.Price) || 0), 0);

        const row = document.createElement('div');
        row.className = 'budget-row';
        row.innerHTML = `
            <span class="room-name">${room}</span>
            <span>₪${roomTotal.toLocaleString()}</span>
        `;
        els.budgetList.appendChild(row);
    });
}

// -----------------------------------------------------------------------------
// Utilities
// -----------------------------------------------------------------------------

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.remove('hidden');
    toast.style.opacity = '1';

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.classList.add('hidden'), 300);
    }, 3000);
}

// Start
document.addEventListener('DOMContentLoaded', init);