# Product Requirements Document (PRD) - Habitat Hub

## 1. Executive Summary
Habitat Hub is a high-end personal interior design and furniture budgeting Web App (PWA) designed for a couple managing a home furnishing project. It aims to replace messy spreadsheets with a highly visual, mobile-first experience. The app leverages AI to simplify data entry and provides a luxurious, organized interface for managing furniture items, options, and budgets across different rooms.

## 2. Target Audience
*   **Primary Users:** 2-3 specific users (a couple) managing a home renovation/furnishing project.
*   **Usage Context:** Personal use, primarily on mobile devices.

## 3. Tech Stack
*   **Frontend:** HTML, CSS, Vanilla JS.
*   **PWA:** Manifest + Service Worker (for installability and offline capabilities).
*   **Hosting:** GitHub Pages.
*   **Backend/Database:** Google Sheets via Google Apps Script (GAS).
*   **AI Layer:** External Vision API triggered securely via GAS backend.

## 4. Core Features & Functional Requirements

### 4.1. Authentication
*   **Mechanism:** Simple hardcoded passcode screen.
*   **Passcode:** `SA8RG`
*   **Behavior:** Users must enter the correct passcode to access the app. Unauthorized access is blocked.

### 4.2. Navigation & Structure
*   **Room-Based Organization:** The app is structured by rooms.
*   **Room List:**
    *   Kitchen
    *   Living Room
    *   Foyer
    *   Bedroom
    *   Mamad
    *   Bathroom
    *   Toilets
*   **Navigation:** Users can easily switch between rooms to view and manage items specific to that area.

### 4.3. Smart Adding Mechanism (The AI Flow)
*   **Trigger:** User clicks a "+" button.
*   **Input:**
    *   User enters a Title.
    *   User uploads a screenshot of the furniture.
    *   User pastes the product URL.
*   **Processing:**
    *   Image and data are sent to the GAS backend.
    *   GAS calls an external Vision API.
*   **Extraction:** The Vision API extracts:
    *   Item Name
    *   Dimensions (Length, Width, Height - or "Unknown" if missing)
    *   Image
    *   Price
    *   Site (Source)
*   **Draft Card:**
    *   Extracted data populates a "Draft Card".
    *   **Review:** User reviews the data.
    *   **Edit:** User can fix incorrect data.
    *   **Crop:** User can use a crop tool for the image if needed.
    *   **Mandatory Fields:** User must fill in any missing mandatory fields.
    *   **Approval:** User approves the draft to save the item.

### 4.4. Item Management & Variations (Options)
*   **Edit/Delete:** Users can manually edit or delete existing items.
*   **Accordion Options:**
    *   Users can add alternative options for a specific item.
    *   These options appear in an accordion dropdown below the main item.
    *   **"Set as Main":** Each option has a button to swap it with the primary item. When clicked, the option becomes the main item, and the previous main item becomes an option.

### 4.5. Financial Logic
*   **Room Subtotal:**
    *   Calculates the sum of prices for *only* the main items in a specific room.
    *   Options (alternatives) are excluded from the subtotal.
*   **Grand Total:**
    *   Calculates the sum of all Room Subtotals.
    *   Displayed prominently in the layout.

### 4.6. Floor Plan Viewer
*   **Functionality:** A dedicated section to view the apartment's floor plan.
*   **Input:** Upload/View a High-Res PNG of the floor plan.
*   **Interaction:**
    *   **Pan & Zoom:** Users can pan across the image and zoom in/out (pinch-to-zoom for mobile).

## 5. User Flows

### 5.1. Adding a New Item
1.  User navigates to a specific Room (e.g., Living Room).
2.  User taps the "+" button.
3.  User inputs Title, uploads Image, and pastes URL.
4.  App sends data to GAS -> Vision API.
5.  App presents a "Draft Card" with extracted details.
6.  User reviews, edits, crops image (if needed), and fills missing fields.
7.  User clicks "Save/Approve".
8.  Item is added to the Room's main list.
9.  Room Subtotal and Grand Total update automatically.

### 5.2. Managing Options
1.  User taps on an existing item (e.g., "Sofa").
2.  User selects "Add Option".
3.  User follows the standard adding flow (or a simplified manual entry).
4.  The new option appears in an accordion below the main "Sofa" item.
5.  User can expand the accordion to view options.
6.  User taps "Set as Main" on an option.
7.  The option swaps places with the current main item.
8.  Financial totals update to reflect the price of the new main item.

## 6. Data Models (Google Sheets Schema)

The backend will rely on a Google Sheet. Suggested structure:

**Sheet Name: `Items`**

| Column Name | Type | Description |
| :--- | :--- | :--- |
| `ID` | String | Unique Identifier (UUID) |
| `Room` | String | Room Name (e.g., "Living Room") |
| `Name` | String | Item Name |
| `Image_URL` | String | URL to the image (stored in Drive or base64 if small enough/optimized) |
| `Product_URL` | String | Link to the product page |
| `Price` | Number | Cost of the item |
| `Currency` | String | Currency code (e.g., USD, EUR) |
| `Dimensions` | String | L x W x H |
| `Status` | String | "Main" or "Option" |
| `Parent_ID` | String | If Status is "Option", this links to the Main Item's ID |
| `Notes` | String | User notes |
| `Created_At` | Timestamp | Date added |

**Sheet Name: `Settings`** (Optional, for storing global values like Grand Total if not calculated on fly)

## 7. Non-Functional Requirements

### 7.1. UI/UX & Design Language
*   **Vibe:** High-End, Luxurious.
*   **Color Palette:**
    *   Primary: Royal Blue (`#4169E1` or darker like `#002366`) or Royal Green (`#136207`).
    *   Accents: Gold or Silver for a premium feel.
*   **Theme:** Dark Mode / Light Mode toggle.
*   **Layout:**
    *   **Asymmetric:** Dominant image on one side (e.g., left or top), with smaller, clear text (Name, Dimensions, Price) on the other.
    *   **Headers:** Room names act as clear section headers.

### 7.2. Performance
*   **Load Time:** The PWA should load quickly.
*   **Image Optimization:** Images should be optimized for mobile viewing to prevent lag, especially in the Floor Plan Viewer.
*   **Offline Capability:** Basic viewing of cached data should be available offline (PWA Service Worker).

### 7.3. Security
*   **Access Control:** The passcode `SA8RG` must be enforced before any data is shown.
*   **API Security:** Calls to the Vision API via GAS should be secured and not exposed directly in the frontend code if possible (proxy through GAS).
