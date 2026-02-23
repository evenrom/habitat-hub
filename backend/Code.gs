// Environment Variables
const SPREADSHEET_ID = '17tPe9sjSa3RTaGRhLpTn7Fx0Fw_OCPRx1wIySSv90dw';
const FOLDER_ID = '15TwDZ0rzZxZvrlOo2mC03imHbbxTCIeR';
const PASSCODE = 'SA8RG';
const GEMINI_API_KEY = 'YOUR_GEMINI_API_KEY_HERE';

// ------------------------------------------------------------------------------------------------
// Core API
// ------------------------------------------------------------------------------------------------

/**
 * Handle GET requests.
 * Returns a simple HTML placeholder.
 */
function doGet(e) {
  return HtmlService.createHtmlOutput('<h1>Habitat Hub API Active</h1>');
}

/**
 * Handle POST requests.
 * The main API router.
 */
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);

    // SECURITY GATE: Verify Passcode
    if (payload.passcode !== PASSCODE) {
      return createJsonResponse({ error: 'Unauthorized: Invalid Passcode' }, 401);
    }

    // Route to specific functions based on action
    switch (payload.action) {
      case 'getInitialData':
        return getInitialData();
      case 'analyzeAndUpload':
        return analyzeAndUpload(payload);
      case 'saveItem':
        return saveItem(payload);
      case 'updateItem':
        return updateItem(payload);
      case 'deleteItem':
        return deleteItem(payload);
      default:
        return createJsonResponse({ error: 'Unknown Action' }, 400);
    }
  } catch (error) {
    return createJsonResponse({ error: error.toString() }, 500);
  }
}

// ------------------------------------------------------------------------------------------------
// Helper Functions
// ------------------------------------------------------------------------------------------------

function createJsonResponse(data, statusCode = 200) { // statusCode is mainly conceptual in GAS for client handling
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ------------------------------------------------------------------------------------------------
// Action Handlers
// ------------------------------------------------------------------------------------------------

/**
 * Reads the 'Config' tab (Row 2 under 'Value' for Rooms list) and the 'Items' tab (all data rows).
 */
function getInitialData() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    // 1. Get Rooms from Config
    const configSheet = ss.getSheetByName('Config');
    let rooms = [];
    if (configSheet) {
      // Assuming Config sheet has headers Key, Value in row 1
      // And we are looking for 'Room_List' key or just reading row 2 value as per instruction?
      // Instruction says: "Read the 'Config' tab (Row 2 under 'Value' for Rooms list)"
      // Let's assume Row 2, Column 2 (B2) contains the comma-separated list or JSON string of rooms.
      // Adjust if schema is different. Let's assume comma separated string for simplicity or JSON.
      // Or maybe it's a list in a column.
      // Prompt says: "Row 2 under 'Value' for Rooms list".
      // Let's assume Column B is Value.
      const roomValue = configSheet.getRange('B2').getValue();
      if (roomValue) {
        // Try parsing as JSON, else split by comma
        try {
          rooms = JSON.parse(roomValue);
        } catch (e) {
          rooms = roomValue.split(',').map(r => r.trim());
        }
      }
    }

    // 2. Get Items
    const itemsSheet = ss.getSheetByName('Items');
    let items = [];
    if (itemsSheet) {
      const data = itemsSheet.getDataRange().getValues();
      const headers = data[0]; // Row 1 is headers
      // Map rows to objects
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        let item = {};
        for (let j = 0; j < headers.length; j++) {
          item[headers[j]] = row[j];
        }
        items.push(item);
      }
    }

    return createJsonResponse({ rooms: rooms, items: items });

  } catch (error) {
    return createJsonResponse({ error: 'Failed to fetch initial data: ' + error.toString() }, 500);
  }
}

/**
 * Receive base64Image.
 * Convert Base64 to Blob and save to Google Drive.
 * Call Gemini API to extract details.
 * Return extracted data + imageID.
 */
function analyzeAndUpload(payload) {
  try {
    const base64Image = payload.base64Image;
    if (!base64Image) {
      return createJsonResponse({ error: 'No image data provided' }, 400);
    }

    // 1. Save Image to Drive
    // Remove header if present (e.g., "data:image/png;base64,")
    const validBase64 = base64Image.split(',').pop();
    const blob = Utilities.newBlob(Utilities.base64Decode(validBase64), 'image/png', 'furniture_upload_' + new Date().getTime()); // Defaulting to png, can be dynamic
    const folder = DriveApp.getFolderById(FOLDER_ID);
    const file = folder.createFile(blob);
    const imageID = file.getId();

    // Enable file to be viewable by anyone with the link (or at least the user)
    // In a real app, strict permissions are better. For this:
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);


    // 2. Call Gemini API
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;

    const promptText = "Analyze this furniture image. Extract: Name, Price (numbers only), Dimensions (Length, Width, Height). Return STRICTLY a valid JSON object with keys: name, price, dim_l, dim_w, dim_h, image_analysis. If a dimension is unknown, use 'Unknown'.";

    const requestBody = {
      contents: [
        {
          parts: [
            { text: promptText },
            {
              inline_data: {
                mime_type: "image/png", // Assuming png from the blob creation above
                data: validBase64
              }
            }
          ]
        }
      ]
    };

    const options = {
      method: 'POST',
      contentType: 'application/json',
      payload: JSON.stringify(requestBody),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(geminiUrl, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (responseCode !== 200) {
      throw new Error(`Gemini API Error (${responseCode}): ${responseText}`);
    }

    const jsonResponse = JSON.parse(responseText);

    // Parse Gemini's candidate text which should be JSON
    let extractedData = {};
    if (jsonResponse.candidates && jsonResponse.candidates[0] && jsonResponse.candidates[0].content && jsonResponse.candidates[0].content.parts) {
      const textPart = jsonResponse.candidates[0].content.parts[0].text;
      // Clean up markdown code blocks if Gemini returns them
      const jsonString = textPart.replace(/```json/g, '').replace(/```/g, '').trim();
      extractedData = JSON.parse(jsonString);
    }

    // Return combined result
    return createJsonResponse({
      success: true,
      imageID: imageID,
      extractedData: extractedData
    });

  } catch (error) {
    return createJsonResponse({ error: 'Analysis failed: ' + error.toString() }, 500);
  }
}

/**
 * Append a new row to the 'Items' sheet.
 */
function saveItem(payload) {
  try {
    const item = payload.item;
    if (!item) {
      return createJsonResponse({ error: 'No item data provided' }, 400);
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Items');
    if (!sheet) {
      return createJsonResponse({ error: 'Items sheet not found' }, 500);
    }

    // Generate ID if not provided (though prompt says generate simple UUID/Timestamp string)
    // The prompt says: "ID (generate a simple UUID/Timestamp string)" - assuming backend should do it if not present,
    // or blindly generate one. Let's generate one.
    const id = Utilities.getUuid();
    const timestamp = new Date();

    // EXPECTED COLUMNS: ID, Room, Type, ParentID, Name, Price, Dim_L, Dim_W, Dim_H, ImageID, ProductURL, Timestamp
    const newRow = [
      id,
      item.room || '',
      item.type || 'Main',
      item.parentID || '',
      item.name || '',
      item.price || 0,
      item.dim_l || '',
      item.dim_w || '',
      item.dim_h || '',
      item.imageID || '',
      item.productURL || '',
      timestamp
    ];

    sheet.appendRow(newRow);

    return createJsonResponse({ success: true, id: id, message: 'Item saved successfully' });

  } catch (error) {
    return createJsonResponse({ error: 'Save failed: ' + error.toString() }, 500);
  }
}

/**
 * Find a row by ID in the 'Items' sheet and update its values.
 */
function updateItem(payload) {
  try {
    const item = payload.item;
    if (!item || !item.id) {
      return createJsonResponse({ error: 'No item ID provided for update' }, 400);
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Items');
    const data = sheet.getDataRange().getValues();

    // Find row index (0-based in array, +1 for sheet row)
    // Assuming ID is in column 1 (index 0)
    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] == item.id) {
        rowIndex = i + 1; // Sheet row index (1-based)
        break;
      }
    }

    if (rowIndex === -1) {
      return createJsonResponse({ error: 'Item not found' }, 404);
    }

    // Columns: ID, Room, Type, ParentID, Name, Price, Dim_L, Dim_W, Dim_H, ImageID, ProductURL, Timestamp
    // We update specific fields provided in the payload, or overwrite all?
    // Prompt says: "Find a row by ID in the 'Items' sheet and update its values. (Crucial for handling edits and the "Set as Main" swapping logic for alternatives)"
    // It's safer to overwrite the row with provided data, but we must preserve the ID and maybe Timestamp if not provided.
    // Let's assume payload.item contains the FULL desired state of the row, or at least the fields to update.
    // Ideally, for "Set as Main", the frontend sends the updated objects.

    // Let's retrieve current row to merge if needed, but for simplicity, we'll write what's given for the known columns.
    // Assuming the frontend sends the complete object or we only update specific columns.
    // Since we need to support "Set as Main", which changes Type and ParentID, we should update those.

    // Let's implement a merge strategy:
    const currentRow = data[rowIndex - 1];

    // Map of Column Index to Key
    const colMap = {
      0: 'id',
      1: 'room',
      2: 'type',
      3: 'parentID',
      4: 'name',
      5: 'price',
      6: 'dim_l',
      7: 'dim_w',
      8: 'dim_h',
      9: 'imageID',
      10: 'productURL',
      11: 'timestamp'
    };

    // Construct the updated row array
    const updatedRow = [...currentRow];

    // Update fields if present in payload
    if (item.room !== undefined) updatedRow[1] = item.room;
    if (item.type !== undefined) updatedRow[2] = item.type;
    if (item.parentID !== undefined) updatedRow[3] = item.parentID;
    if (item.name !== undefined) updatedRow[4] = item.name;
    if (item.price !== undefined) updatedRow[5] = item.price;
    if (item.dim_l !== undefined) updatedRow[6] = item.dim_l;
    if (item.dim_w !== undefined) updatedRow[7] = item.dim_w;
    if (item.dim_h !== undefined) updatedRow[8] = item.dim_h;
    if (item.imageID !== undefined) updatedRow[9] = item.imageID;
    if (item.productURL !== undefined) updatedRow[10] = item.productURL;
    // We usually don't update timestamp on edit, or we do? Let's leave it unless specified.

    // Write back to sheet
    sheet.getRange(rowIndex, 1, 1, updatedRow.length).setValues([updatedRow]);

    return createJsonResponse({ success: true, message: 'Item updated successfully' });

  } catch (error) {
    return createJsonResponse({ error: 'Update failed: ' + error.toString() }, 500);
  }
}

/**
 * Find a row by ID and delete it.
 */
function deleteItem(payload) {
  try {
    const id = payload.id;
    if (!id) {
      return createJsonResponse({ error: 'No item ID provided for delete' }, 400);
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Items');
    const data = sheet.getDataRange().getValues();

    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] == id) {
        rowIndex = i + 1;
        break;
      }
    }

    if (rowIndex === -1) {
      return createJsonResponse({ error: 'Item not found' }, 404);
    }

    sheet.deleteRow(rowIndex);

    return createJsonResponse({ success: true, message: 'Item deleted successfully' });

  } catch (error) {
    return createJsonResponse({ error: 'Delete failed: ' + error.toString() }, 500);
  }
}
