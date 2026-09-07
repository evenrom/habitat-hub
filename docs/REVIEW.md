# Habitat review — 7 September 2026

Scope: frontend, Apps Script source, floor-plan integration, project documents, and all 47 populated Items records in HabitatHub_DB. Browser verification used a read-only snapshot of the current Sheet. No app deployment or live purchase/save workflow was performed.

## Completed

- Finance now separates Required and Nice to have, each with Paid, Left to spend, and Expected total, for the apartment and each room.
- Remaining is the sum of unpurchased selected-item prices. Purchased items use actual price, falling back to listed price with a disclosure. Zero actual price is valid. Expected total = paid + remaining.
- Alternatives remain excluded. Purchased alternatives produce a visible data warning. Missing/invalid selected prices produce an incomplete-total warning.
- Configured empty rooms are displayed, and rooms found in Items are included even if missing from Config. Rooms sort by required amount remaining.
- Alternative promotion inherits the selected item's priority. Purchased options cannot be swapped, preventing paid spending from disappearing.
- Restored missing CSS color/font variables used throughout the existing interface.
- Corrected Items!N38 from TRUE to FALSE after the owner confirmed only the Electrolux refrigerator was purchased. Readback verified the Hisense flag is FALSE.

## Current amounts

| Category | Paid | Left to spend | Expected total |
| --- | ---: | ---: | ---: |
| Required | ₪21,786 | ₪27,731 | ₪49,517 |
| Nice to have | ₪0 | ₪20,887 | ₪20,887 |
| Combined | ₪21,786 | ₪48,618 | ₪70,404 |

Purchased means fully paid, confirmed by the owner. Three purchased items have blank actual_price: STOCKHOLM 2025 sideboard, Oslo dining table, and Electrolux refrigerator. Paid therefore includes their listed prices; confirm actual amounts before treating this as a reconciled payment ledger.

## Remaining issues, in priority order

1. **Private access:** the passcode is embedded in frontend JavaScript and backend source. It cannot restrict access to the owner. The backend accepts writes/deletes with that same publicly delivered value. Add server-verified owner authentication; rotating the current client-side passcode alone is insufficient. Drive uploads also use anyone-with-link sharing.
2. **Purchase editing:** the app offers Mark as Purchased but no actual-paid amount editor or undo purchase control. Add both so the finance figures can be maintained without editing Sheets. Backend saveItem also defaults actual_price to price, which can disguise an unconfirmed payment amount.
3. **Non-atomic swaps:** promotion, demotion, and sibling reparenting are separate API calls. A failed call can leave two Main items or detached alternatives. Move the operation into one locked backend action with validation and recovery.
4. **Add/edit state:** closing the add dialog clears only some state. pendingAlternativeParentId survives cancellation, and the input pane disabled during Edit is not restored on close. Escape bypasses the cleanup handler. Route every close/open through one reset function. Adding from All also assigns room='All'; provide a room selector. Earlier suspicion that the review pane is hidden was not confirmed: the CSS has no general .hidden rule for that pane.
5. **Data consistency:** Foyer is absent from Config.Room_List despite having items and a map room. MODI is Main but retains a parent_id. KNIT Coat Rack has the app URL instead of a product link. No automatic corrections were made to these records.
6. **Budget limit:** Config contains Budget_Limit=45000, which the app does not use. Confirm whether this is still the target. Current required expected cost is ₪4,517 above it; optional-inclusive expected cost is ₪25,404 above it. Keep target headroom separate from money left to spend.
7. **Rendering and input validation:** item names, stores, and URLs are interpolated into HTML in existing item/comparison views. Use textContent or escaping and allow only safe URL protocols. New finance room names and warnings are escaped. Backend saveItem relies on fixed column positions while updateItem uses headers; centralize schema validation.
8. **Other reliability gaps:** filtered refresh after save can hide all items when currentRoom='All'; store-filter logic has the same All handling error. AI failures can return empty details without a clear error, and URL extraction supplies a URL as text without explicit retrieval. The service worker is a pass-through and does not supply offline operation. Architecture documents still contain obsolete three-scenario descriptions; the finance rules in this review supersede those descriptions.

## Design and wording recommendations

For this personal app, prioritize everyday decisions:

1. Use “My apartment”, “Furniture”, “Required”, “Nice to have”, “Paid”, and “Left to spend” consistently. Replace “Magic AI Add” with “Add furniture” and “Analyze” with “Extract details”.
2. Add a compact room summary beside the floor plan: required left, optional left, and purchased count. Clicking a finance room should open its furniture list.
3. Add simple status filters: To buy / Purchased, alongside Required / Nice to have. Keep the same green and warm-gold category accents used in the new dashboard.
4. Make item entry work well on mobile: one-column fields, a required room selector, editable paid amount, and a clear saved confirmation. Keep AI extraction optional.

## Validation

- `node --test --test-isolation=none tests/budget.test.mjs`: four calculation tests passed (cross-room/category totals, discounts/overspending, zero/blank actual prices, alternatives, invalid prices, empty rooms).
- JavaScript syntax checks passed.
- Headless Edge at 1440×1000 and 390×844: finance opens, current-data totals render, tables have no horizontal overflow, Escape closes, and no uncaught page errors. Screenshots inspected.
- Browser API responses used a current Sheet snapshot to avoid changing live purchases. Live backend mutation flows and deployed frontend remain unverified.

## Room planning and shopping filters

- Room summaries show required remaining and selected-item purchase counts, independent of list filters. Click a summary or floor-plan room to open its furniture list.
- Combine All / To buy / Purchased with All priorities / Required / Nice to have and a store selector. Empty matches display a message; Reset filters restores all furniture.
- Shop by store opens To buy, grouped by retailer across rooms. Priority and store choices remain selected. Item cards identify purchase status, priority, and (in shopping view) room.
- Save/purchase/swap state updates refresh room summaries and filtered lists immediately. No database schema changes.
- Validation: six calculation/filter tests pass; desktop/mobile browser checks cover navigation, combined filters, empty results, retailer grouping, and simulated purchase updates. Browser tests use a database snapshot and intercept writes; no live purchases changed.
