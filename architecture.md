# Habitat App (Atelier Workflow) Architecture

## 1. System Overview
Habitat is an asymmetric workflow application designed to facilitate tracking, budgeting, and visualizing interior design items. The app employs a dual-interface approach: Desktop is optimized for heavy data entry (such as AI image extraction and cataloging), while Mobile provides an intuitive experience for tracking purchases and viewing items via interactive floor plans while on-the-go.

The application strictly adheres to the "Tactile Atelier" design language, ensuring a sophisticated, calm, and organized aesthetic. It relies on specific color palettes, glassmorphism overlays, and thin-border standard aesthetics to emphasize a visual hierarchy.

## 2. Tech Stack
The system operates on a zero-cost stack emphasizing simplicity, portability, and complete serverless operation:
* **Frontend:** Deployed via GitHub Pages. It's built with pure Vanilla HTML5, CSS3, and ES6+ JavaScript. There are no heavy frameworks, allowing for rapid execution and straightforward debugging. State is managed via a lightweight vanilla JS Pub/Sub pattern.
* **Backend:** Powered by Google Apps Script (GAS) functioning as a REST API. It handles incoming requests, communicates with Google APIs (Drive, Sheets), processes the AI pipeline using the Gemini API, and returns JSON payloads.
* **Database:** Google Sheets. It acts as the ultimate source of truth, offering immediate, visible debugging and free storage for state tracking.
* **Asset Storage:** Google Drive is used for storing uploaded/cropped images, high-res renders, and SVG maps.

## 3. Database Schema
The Google Sheets database is primarily structured into three key areas, hydrated continuously into the application state:
* **Items Sheet:** Represents the core inventory. It tracks properties like item ID, name, price, dimensions, store/vendor, purchased state, image ID (from Google Drive), `type` ('Main' or 'Alternative'), `parent_id` (linking alternatives to mains), and the `scenario` categorization ('Premium', 'Balanced', 'Pragmatic').
* **Config Sheet:** Stores global application state, including a dynamic list of Room Names (mapped visually to Material Icons on the frontend) and the active `FloorPlan_ImageID` for cloud syncing.
* **Renders Sheet/Array:** Maps interactive visual nodes on the SVG floor plan to specific rendered viewpoints. Includes fields such as `node_id`, `title`, and `drive_image_id`.

## 4. Core Logic
* **3-Tier Budget Calculation:** The application dynamically calculates budgets across three parallel scenarios: 'Premium', 'Balanced', and 'Pragmatic'. The calculation logic processes the items array:
  * If an item is flagged as `is_purchased`, its `actual_price` (or fallback `price`) is added to the `spent` total.
  * Its `price` is always added to the overall `total`.
  * The `remaining` budget is then computed.
  * Alternative items contribute exclusively to their tagged scenario.
* **Main/Alternative Scenario Conflicts:** To prevent logic breakdowns when swapping items, there is strict validation ensuring an 'Alternative' item cannot be saved or assigned the exact same `scenario` ('Premium', 'Balanced', 'Pragmatic') as its Main (parent) item.

## 5. Drive Integration & SVG Render Nodes
The frontend dynamically loads an external SVG map (`assets/floorplan.svg`) and processes interactive SVG `<circle class="render-node">` elements.
* During initialization, the frontend employs Direct Event Binding on these injected nodes to bypass event swallowing from nested SVG layers.
* When clicked, the node's `id` attribute is extracted and matched against the `node_id` within the `renders` array payload fetched from the backend.
* Upon a successful match, the application triggers a high-resolution image modal.
* To bypass Google Drive's strict CORS and cross-origin embedding policies for direct `<img>` tags, the image is loaded securely using the thumbnail API endpoint with a high-resolution parameter: `https://drive.google.com/thumbnail?id=${renderData.drive_image_id}&sz=w1600`.
