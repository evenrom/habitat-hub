# Habitat Hub - UI/UX Redesign PRD & Technical Architecture

## 1. Product Requirements Document (PRD)

### 1.1. Introduction
This document outlines the Product Requirements and Technical Architecture for the UI/UX redesign of **Habitat Hub**, a Progressive Web App (PWA) designed for interior design budgeting and curation. The redesign focuses on a premium high-end dark theme and an asymmetric workflow catering to both desktop (curation) and mobile (shopping execution) usage paradigms.

### 1.2. Product Paradigms (Asymmetric Workflow)
The application architecture and UX must support two distinct interaction models:

#### 1.2.1. Desktop Mode (Curation)
*   **Focus:** High-speed data entry, comprehensive curation, and spatial planning.
*   **Key Workflows:**
    *   Rapid data entry via clipboard paste (CTRL+V).
    *   AI extraction workflows utilizing Gemini for parsing product details.
    *   Detailed, full-screen floor plan viewing and interaction.

#### 1.2.2. Mobile Mode (Shopping Execution)
*   **Focus:** Zero-friction updates on the retail floor, offline resilience, and immediate budget visibility.
*   **Key Workflows:**
    *   **Sticky Budget Header:** Always visible during shopping to maintain financial context.
    *   **Rapid "Purchased" Toggles:** Immediate visual feedback via Optimistic UI when items are bought.
    *   **Sync Status:** Clear indicators for offline state and background synchronization with the GAS backend.

### 1.3. UI/UX & Design System
The redesign adopts a luxurious, high-end aesthetic optimized for readability and reduced visual noise.

*   **Theme Palette:** High-end Dark Theme.
    *   **Background:** Charcoal/Dark Brown (`#292420`)
    *   **Primary CTA / Highlights:** Green (`#567357`)
    *   **Secondary Elements / Text:** Sage (`#adab9e`)
*   **Aesthetic Style:**
    *   **Glassmorphism:** Overlays utilizing background blur and translucent backgrounds to create depth without clutter.
    *   **Outline Buttons:** Transparent backgrounds with primary color borders (`.btn-outline`) to establish clear secondary visual hierarchy and reduce noise.
*   **Layout Structure:** Master-Detail view model.
    *   **Vertical Categories:** Content grouped primarily by "Room" or by "Store", stacked vertically.
    *   **Horizontal Carousels:** Within each vertical category, items are displayed in horizontal swipeable carousels.

### 1.4. Specific Component Logic

#### 1.4.1. Horizontal Item Carousels & Cards
*   **Aspect Ratio Forcing:** Item images are originally stored as 1:1 Drive thumbnails. The frontend must strictly force a 3:2 landscape aspect ratio using CSS: `aspect-ratio: 3/2`, `object-fit: cover`, `object-position: center`.
*   **Lazy Loading:** Carousels must utilize the `IntersectionObserver` API to lazy-render DOM elements as they scroll into view to prevent performance degradation and DOM bloat.

#### 1.4.2. Image Overlays (Strict Constraints)
*   **Design:** The Item Name and Price overlay directly on top of the item image, aligned to the bottom.
*   **Legibility:** A subtle dark gradient overlay is required behind the text for contrast against varied image backgrounds.
*   **Typography Constraint:** The Item Name **must be exactly one single line**. Overflowing text must be truncated with an ellipsis (`text-overflow: ellipsis; white-space: nowrap; overflow: hidden;`). No line wrapping is permitted.

#### 1.4.3. Purchased State & Sorting (Optimistic UI)
*   **Action:** Toggling an item as "Purchased".
*   **Immediate UI Response:**
    *   The item's opacity is immediately reduced to 50% (faded visual state).
    *   The item dynamically and automatically moves to the very end of its respective carousel/list.
*   **Backend Sync:** The local mutation is handled by the `RenderManager` before an asynchronous POST request is dispatched to Google Apps Script.

---

## 2. Technical Architecture Document

### 2.1. System Overview
The system relies on a strictly defined existing backend architecture. All modifications for this redesign are purely frontend-focused.

*   **Frontend:** HTML5, CSS3 (Custom Properties), Vanilla JavaScript (ES6+), PWA (`manifest.json`, Service Worker).
*   **Backend (Immutable):** Google Apps Script (GAS) acting as an API Gateway, routing `doPost` requests.
*   **Database (Immutable):** Google Sheets (`Items` and `Config` tabs).
*   **Storage (Immutable):** Google Drive (hosting public 1:1 aspect ratio thumbnails).

### 2.2. State Management & Data Flow

#### 2.2.1. The `Store` Object
A centralized state container holding:
*   `items`: Array of all furniture items fetched from GAS.
*   `rooms`: Array of room definitions from the Config sheet.
*   `viewMode`: Current grouping ('Room' or 'Store').
*   `syncQueue`: Pending mutations waiting for network connectivity.

#### 2.2.2. The `RenderManager`
A new client-side orchestration class responsible for managing DOM state without triggering full application re-renders or unnecessary GAS API calls.

*   **Responsibilities:**
    *   Filtering, grouping, and sorting the `Store.items` array based on the current `viewMode`.
    *   Handling local state mutations (e.g., Optimistic updates for the "Purchased" state).
    *   Managing DOM updates efficiently.

#### 2.2.3. Data Flow Diagram (Optimistic UI Update)
1.  **User Action:** Clicks "Purchased" toggle on `Item A`.
2.  **`RenderManager` (Local Mutation):**
    *   Updates `Item A.isPurchased = true` in the local `Store`.
    *   Applies `.is-purchased` CSS class (50% opacity) to `Item A`'s DOM node.
    *   Resorts the active carousel list, moving `Item A` to the end.
    *   Re-renders the specific carousel section in the DOM.
3.  **Background Sync:** An async `updateItem` call is fired to the GAS endpoint.
4.  **Error Handling:** If the GAS call fails, the `RenderManager` catches the error, reverts the local state, re-renders the item to its previous position, and alerts the user.

### 2.3. Component Tree Architecture

The UI is constructed using Vanilla JS components (factory functions or classes rendering template literals).

```
AppRoot
 ├── StickyBudgetHeader (Mobile-focused, persistent)
 │    ├── TotalBudget
 │    ├── DynamicProgressBar (Spent vs Remaining)
 │    └── SyncStatusIndicator
 ├── NavigationTabs (View Toggle)
 │    ├── ByRoomButton
 │    └── ByStoreButton
 └── RenderManager Container
      └── VerticalCategoryList (e.g., "Living Room" or "IKEA")
           ├── CategoryHeader
           └── HorizontalCarousel (IntersectionObserver attached)
                ├── ItemCard (1..n)
                │    ├── ImageContainer (3:2 aspect ratio CSS)
                │    │    └── BackgroundImage (Drive 1:1 thumbnail)
                │    ├── GradientOverlay
                │    ├── ItemName (Single line, Ellipsis)
                │    ├── ItemPrice
                │    └── QuickPurchaseToggle
                └── ItemCard (Purchased - 50% opacity, end of list)
```

### 2.4. Performance & Rendering Strategy (Intersection Observer)
To ensure smooth scrolling on mobile devices with potentially hundreds of items, the `RenderManager` implements a lazy-rendering strategy.

1.  **Initialization:** Only the `CategoryHeader` and empty `HorizontalCarousel` containers are rendered initially for all categories.
2.  **Observer Setup:** An `IntersectionObserver` watches the `HorizontalCarousel` containers.
3.  **Lazy Hydration:** When a carousel enters the viewport threshold, the `RenderManager` instantiates and injects the actual `ItemCard` DOM elements for that specific category.
4.  **Image Loading:** `ItemCard` images utilize `loading="lazy"` attributes natively to defer network requests until the card is near the visible viewport.