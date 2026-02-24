// Environment & Config
const BACKEND_URL = 'https://script.google.com/macros/s/AKfycbw2_7k7c56NCnOegNaJYgjFYvTF9hRCEr1EEcvnWBYE2kaHSwGq_f1kGNX3Haiqsbej/exec';
const PASSCODE = 'SA8RG';
const CONFIG = {
    themeKey: 'habitat_theme',
    floorPlanImg: 'https://via.placeholder.com/2000x1500.png?text=Floor+Plan+High+Res' // Placeholder, in real app this would be configurable
};

// Icon Mapping
const ROOM_ICONS = {
    'מטבח': 'restaurant',
    'סלון': 'weekend',
    'מבואה': 'sensor_door',
    'חדר שינה': 'bed',
    'ממ"ד': 'security',
    'רחצה ושירותים': 'bathtub'
};

const DEFAULT_ROOM_ICON = 'meeting_room';

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
        validation: document.getElementById('modal-validation'),
        details: document.getElementById('modal-item-details')
    },
    detailModal: {
        img: document.getElementById('detail-img'),
        name: document.getElementById('detail-name'),
        price: document.getElementById('detail-price'),
        dims: document.getElementById('detail-dims'),
        link: document.getElementById('detail-link')
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
    panzoomEl: document.getElementById('panzoom-element'),
    floorPlanUpload: {
        btn: document.getElementById('btn-upload-floorplan'),
        input: document.getElementById('floorplan-upload-input')
    }
};

// -----------------------------------------------------------------------------
// Initialization
// -----------------------------------------------------------------------------

async function init() {
    setupTheme();
    setupNavigation();
    setupPanzoom();
    setupEventListeners();
    setupFloorPlanUpload(); // Setup Upload Logic
    setupClipboardPaste(); // Setup Clipboard Paste Logic

    // PWA Service Worker Registration
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('SW Registered', reg))
            .catch(err => console.error('SW Registration failed', err));
    }

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
            body: JSON.stringify(body),
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
        alert('שגיאת מערכת: ' + (error.message || "Unknown error occurred"));
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

        // Sync floor plan from cloud if available
        if (data.floorPlanImageID) {
            const cloudUrl = `https://drive.google.com/thumbnail?id=${data.floorPlanImageID}&sz=w2000`;
            renderFloorPlan(cloudUrl);
        }

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
    // Hide all views first
    Object.values(els.views).forEach(el => {
        el.classList.remove('active');
        el.classList.add('hidden');
    });

    const target = document.getElementById(viewId);
    if (target) {
        target.classList.remove('hidden');
        target.classList.add('active');
    }

    // Header Back Button Logic
    if (viewId === 'view-room-detail') {
        els.backToRooms.classList.remove('hidden');
    } else {
        els.backToRooms.classList.add('hidden');
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
        const iconName = ROOM_ICONS[roomName] || DEFAULT_ROOM_ICON;

        card.innerHTML = `
            <div class="room-icon"><span class="material-icons-outlined">${iconName}</span></div>
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
    switchView('view-room-detail');
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

    const imgUrl = mainItem.ImageID ? `https://lh3.googleusercontent.com/d/${mainItem.ImageID}=w200` : 'https://via.placeholder.com/80';
    const mainItemJSON = encodeURIComponent(JSON.stringify(mainItem));

    let html = `
        <div class="item-main">
            <img src="${imgUrl}" class="item-img" alt="${mainItem.Name}" onclick="openItemDetails('${mainItemJSON}')">
            <div class="item-info">
                <div class="item-title">${mainItem.Name}</div>
                <div class="item-price">₪${mainItem.Price ? Number(mainItem.Price).toLocaleString() : '0'}</div>
                <div class="item-dims">${mainItem.Dim_L || '?'} x ${mainItem.Dim_W || '?'} x ${mainItem.Dim_H || '?'}</div>
            </div>
            ${mainItem.ProductURL ? `<a href="${mainItem.ProductURL}" target="_blank" class="material-icons-outlined" style="color:var(--color-secondary); text-decoration:none;">link</a>` : ''}
        </div>
    `;

    // Alternatives Accordion
    if (alternatives.length > 0 || true) {
        html += `
            <div class="accordion-header" onclick="toggleAccordion(this)">
                <span>Alternatives (${alternatives.length})</span>
                <span class="material-icons-outlined">expand_more</span>
            </div>
            <div class="accordion-body">
                ${alternatives.map(alt => {
                    const altImg = alt.ImageID ? `https://lh3.googleusercontent.com/d/${alt.ImageID}=w80` : 'https://via.placeholder.com/40';
                    const altItemJSON = encodeURIComponent(JSON.stringify(alt));
                    return `
                    <div class="alt-item">
                        <img src="${altImg}" style="width:40px;height:40px;border-radius:4px;margin-right:8px;object-fit:cover;" onclick="openItemDetails('${altItemJSON}')">
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

window.openItemDetails = function(itemJson) {
    const item = JSON.parse(decodeURIComponent(itemJson));
    const imgUrl = item.ImageID ? `https://lh3.googleusercontent.com/d/${item.ImageID}=w1000` : 'https://via.placeholder.com/600';

    els.detailModal.img.src = imgUrl;
    els.detailModal.name.textContent = item.Name;
    els.detailModal.price.textContent = '₪' + Number(item.Price).toLocaleString();
    els.detailModal.dims.textContent = `${item.Dim_L || '?'} x ${item.Dim_W || '?'} x ${item.Dim_H || '?'} cm`;

    if (item.ProductURL) {
        els.detailModal.link.href = item.ProductURL;
        els.detailModal.link.style.display = 'inline-flex';
    } else {
        els.detailModal.link.style.display = 'none';
    }

    els.modals.details.classList.remove('hidden');
    els.modals.details.style.display = 'flex';
    els.modals.details.offsetHeight;
    els.modals.details.classList.add('visible');
}

window.toggleAccordion = function(header) {
    const body = header.nextElementSibling;
    const icon = header.querySelector('.material-icons-outlined');
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
    const mainItem = store.items.find(i => i.ID === mainId);
    const altItem = store.items.find(i => i.ID === altId);

    if (!mainItem || !altItem) return;

    if (!confirm(`Swap "${altItem.Name}" to be the Main item?`)) return;

    showToast('Swapping items...');

    // 1. Update Local State
    const siblings = store.items.filter(i => i.ParentID === mainId && i.ID !== altId);
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

    els.modals.add.classList.remove('hidden'); // CRITICAL FIX: remove hidden !important
    els.modals.add.style.display = 'flex'; // Ensure flex
    // Force reflow
    els.modals.add.offsetHeight;
    els.modals.add.classList.add('visible'); // visible class for opacity transition
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
                aspectRatio: 1, // MUST BE 1 FOR SQUARE CROP
                viewMode: 1,
            });
            els.addItemForm.analyzeBtn.disabled = false;
        };
        reader.readAsDataURL(file);
    }
});

// Analyze Button
els.addItemForm.analyzeBtn.addEventListener('click', async (e) => {
    e.preventDefault(); // CRITICAL: Prevent native form submission
    console.log("Analyze button clicked.");
    if (!store.cropper) {
        alert("מערכת החיתוך לא נטענה. אנא העלה את התמונה מחדש.");
        return;
    }
    try {
        // Get cropped canvas
        const canvas = store.cropper.getCroppedCanvas({
            width: 600,
            height: 600
        });
        if (!canvas) {
            alert("שגיאה בחיתוך התמונה. נסה שוב.");
            return;
        }
        const base64Image = canvas.toDataURL('image/png');
        const fullBase64Image = els.addItemForm.imgToCrop.src; // Capture full image

        console.log("Image processed, opening validation modal...");
        // Close Add Modal
        els.modals.add.classList.remove('visible');
        setTimeout(() => els.modals.add.style.display = 'none', 300);
        // Open Validation Modal
        await openValidationModal(base64Image, fullBase64Image);
    } catch (error) {
        console.error("Image processing error:", error);
        alert("שגיאה פנימית בעיבוד התמונה: " + error.message);
    }
});

async function openValidationModal(base64Image, fullBase64Image) {
    try {
        els.modals.validation.classList.remove('hidden'); // CRITICAL: Ensure modal is visible
        els.modals.validation.style.display = 'flex';
        // Force reflow
        els.modals.validation.offsetHeight;
        els.modals.validation.classList.add('visible');

        els.validationForm.loader.classList.remove('hidden');
        els.validationForm.container.classList.add('hidden');

        console.log("Validation modal opened, calling API...");
        // Call API
        const result = await apiCall('analyzeAndUpload', { base64Image: base64Image, fullBase64Image: fullBase64Image });

        if (result && result.success) {
            populateValidationForm(result.extractedData, result.imageID, base64Image);
        } else {
            showToast('Analysis failed.');
            els.modals.validation.classList.remove('visible');
        }
    } catch (error) {
        console.error("Validation modal error:", error);
        alert("שגיאה בפתיחת חלונית האימות: " + error.message);
        els.modals.validation.classList.remove('visible'); // Ensure modal closes on error
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
    // Note: Panzoom needs to be re-initialized if the element content changes entirely?
    // Or we keep the element and change content.
    // The library targets els.panzoomEl.
    const pz = Panzoom(els.panzoomEl, {
        maxScale: 5,
        contain: 'outside'
    });

    els.panzoomEl.parentElement.addEventListener('wheel', pz.zoomWithWheel);
}

function setupFloorPlanUpload() {
    if (!els.floorPlanUpload.btn || !els.floorPlanUpload.input) return;

    els.floorPlanUpload.btn.addEventListener('click', () => {
        els.floorPlanUpload.input.click();
    });

    els.floorPlanUpload.input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (evt) => {
                const base64 = evt.target.result;
                // Render immediately (local first) - REMOVED FOR CLOUD SYNC
                // renderFloorPlan(base64);
                // localStorage.setItem('habitat_floorplan', base64);

                // Show loading state
                const originalBtnText = els.floorPlanUpload.btn.textContent;
                els.floorPlanUpload.btn.textContent = "מעלה...";
                els.floorPlanUpload.btn.disabled = true;

                showToast('Syncing to cloud...');

                try {
                    const result = await apiCall('uploadFloorPlan', { base64Image: base64 });
                    if (result && result.success) {
                        const cloudUrl = `https://drive.google.com/thumbnail?id=${result.imageID}&sz=w2000`;
                        renderFloorPlan(cloudUrl);

                        // Re-init panzoom logic if needed (or simply replacing content works)
                        // If we replace the img src, panzoom usually handles it but dimensions might change.
                        // Best to reset panzoom? For now, render is enough.

                        showToast('Floor plan saved to cloud!');
                    } else {
                        showToast('Upload failed.');
                    }
                } catch (err) {
                    console.error('Upload failed', err);
                    showToast('Cloud sync failed.');
                } finally {
                    els.floorPlanUpload.btn.textContent = originalBtnText;
                    els.floorPlanUpload.btn.disabled = false;
                }
            };
            reader.readAsDataURL(file);
        }
    });
}

function renderFloorPlan(src) {
    // Hide placeholder
    const placeholder = els.panzoomEl.querySelector('.plan-placeholder');
    if (placeholder) {
        placeholder.style.display = 'none';
    }

    // Check if img exists, otherwise create it
    let img = els.panzoomEl.querySelector('img');
    if (!img) {
        img = document.createElement('img');
        img.id = 'floorplan-img';
        img.style.maxWidth = '100%';
        img.style.maxHeight = '100%';
        img.style.objectFit = 'contain';
        els.panzoomEl.appendChild(img);
    }
    img.src = src;

    // Slight delay to allow image load before panzoom reset/re-init if complex
    // For simple replacement, this is fine.
}

function setupClipboardPaste() {
    document.addEventListener('paste', (e) => {
        // Check if Add Item modal is visible
        if (els.modals.add.style.display !== 'flex') return;

        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        let blob = null;

        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                blob = items[i].getAsFile();
                break;
            }
        }

        if (blob) {
            // Create a File object from blob if needed, or just use blob
            // The fileInput expects a FileList. We can mock it using DataTransfer.
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(blob);
            els.addItemForm.fileInput.files = dataTransfer.files;

            // Manually trigger change event
            const event = new Event('change', { bubbles: true });
            els.addItemForm.fileInput.dispatchEvent(event);

            showToast('Image pasted from clipboard');
        }
    });
}

function setupEventListeners() {
    // Add any global listeners here if needed
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