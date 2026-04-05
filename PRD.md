# PRD: Habitat Hub v2.0
**Document Status:** Final Approved
**Design Language:** The Tactile Atelier (Dark Theme, Glassmorphism)

## 1. Product Paradigm & Workflow
* **Primary Use Case:** Internal tool for interior design curation and budget tracking.
* **Platform Focus:** Web-first curation (Desktop) via clipboard/URL. Mobile execution for status updates.
* **Core Flow:** Asymmetric workflow separating the "Curation Phase" (heavy data entry, AI extraction) from the "Execution Phase" (shopping, tracking, toggling purchased items).

## 2. Architecture & Tech Stack (Zero-Cost)
* **Frontend:** Vanilla HTML5, CSS3, ES6+ JavaScript. No frameworks (React/Vue).
* **Backend:** Google Apps Script (GAS) acting as an API Gateway (Passcode protected).
* **Database:** Google Sheets ('Config' and 'Items' tabs).
* **Storage:** Google Drive (Image hosting via Thumbnail API).
* **Hosting:** GitHub Pages.
* **AI Engine:** Google Gemini 2.5 Flash API (Text + Vision).

## 3. Design System: "The Tactile Atelier"
* **Layout Base:** LTR directionality, passively supporting RTL text inputs (`dir="auto"`).
* **Color Palette:**
    * Background: `#292420` (Warm Obsidian).
    * Primary CTA: `#567357` (Botanical Green).
    * Accents: `#adab9e` (Sage/Metallic).
    * Text: `#dcd8d7` (Light Grey). No `#FFFFFF`.
* **Surface & Elevation (No-Line Rule):** Hierarchy defined by background color shifts (`surface_container_low`, `surface_container_highest`) and `backdrop-filter: blur(16px)` for floating elements (Glassmorphism). 1px ghost borders (`outline_variant` at 15% opacity) permitted.
* **Typography:** Manrope font. Display sizes for budgets, "blueprint style" ALL CAPS for labels.

## 4. Core Features & UX Mechanics
### A. SVG Interactive Navigation (Hero Section)
* Hardcoded SVG floor plan acting as the primary navigation hub.
* Rooms defined by injected `<polygon data-room-id="...">` hitboxes.
* **Desktop:** Hover applies a translucent fill and ghost border. Click navigates to the room's detail view.
* **Mobile (2-Tap Rule):** First tap applies the active state and shows a tooltip (Room Name + Item Count). Second tap or "Enter" button executes navigation.

### B. "Magic AI Add" (Data Entry)
* Glassmorphism modal prioritizing speed.
* **Input Hierarchy:** URL input -> Clipboard Image Paste / Drag & Drop.
* **Fallback Protocol:** If the AI API times out (8 seconds) or fails, gracefully degrade to the manual data entry form without blocking the user.

### C. Data Visualization & List Management
* **Sticky Budget:** Top header displaying "TOTAL", "SPENT", "REMAINING" floats above content. Recalculates dynamically.
* **Horizontal Carousels:** Room items are displayed in an overflow-x scroll container.
* **Card UI:** 3:2 aspect ratio (`object-fit: cover`), title and price overlay via dark linear gradient.
* **Nested Alternatives:** Alternative items are grouped visually under the Main Item (scaled down, lower elevation) and do not clutter the primary horizontal flow or budget unless swapped.
* **Purchased State:** Marked items receive `opacity: 0.5`, move to the end of the carousel, and update the sticky budget immediately. Add a global toggle to "Hide Purchased".

## 5. State Management & Modularity
* **Optimistic UI:** DOM updates (Purchase toggles, adding items) occur immediately in the ViewManager before waiting for GAS responses.
* **Modular Architecture:** The JS codebase must be separated (e.g., `api.js`, `store.js`, `ui.js`, `app.js`) to prevent a monolithic file structure.
