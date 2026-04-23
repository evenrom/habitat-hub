// Environment Variables
const SPREADSHEET_ID = '17tPe9sjSa3RTaGRhLpTn7Fx0Fw_OCPRx1wIySSv90dw';
const FOLDER_ID = '15TwDZ0rzZxZvrlOo2mC03imHbbxTCIeR';
const PASSCODE = 'SA8RG';
const GEMINI_API_KEY = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');

// ------------------------------------------------------------------------------------------------
// Core API
// ------------------------------------------------------------------------------------------------

function doGet(e) {
  return HtmlService.createHtmlOutput('<h1>Habitat Hub API v2.0 Active</h1>');
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    if (payload.passcode !== PASSCODE) return createJsonResponse({ error: 'Unauthorized' }, 401);

    switch (payload.action) {
      case 'getInitialData': return getInitialData();
      case 'analyzeAndUpload': return analyzeAndUpload(payload);
      case 'uploadImage': return uploadImage(payload);
      case 'saveItem': return saveItem(payload);
      case 'updateItem': return updateItem(payload);
      case 'deleteItem': return deleteItem(payload);
      default: return createJsonResponse({ error: 'Unknown Action' }, 400);
    }
  } catch (error) {
    return createJsonResponse({ error: error.toString() }, 500);
  }
}

function createJsonResponse(data, statusCode = 200) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

// ------------------------------------------------------------------------------------------------
// Action Handlers
// ------------------------------------------------------------------------------------------------
function getInitialData() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    // 1. Parse Config
    const configSheet = ss.getSheetByName('Config');
    let config = {};
    if (configSheet) {
      const configData = configSheet.getDataRange().getValues();
      for (let i = 1; i < configData.length; i++) {
        const key = configData[i][0];
        const value = configData[i][1];
        if (!key) continue;
        if (key === 'Room_List') {
          try { config[key] = JSON.parse(value); } 
          catch (e) { config[key] = value.split(',').map(r => r.trim()); }
        } else {
          config[key] = value;
        }
      }
    }

    // 2. Parse Items
    const itemsSheet = ss.getSheetByName('Items');
    let items = [];
    if (itemsSheet) {
      const data = itemsSheet.getDataRange().getValues();
      const headers = data[0];
      for (let i = 1; i < data.length; i++) {
        let item = {};
        for (let j = 0; j < headers.length; j++) {
          item[headers[j]] = data[i][j];
        }
        items.push(item);
      }
    }

    // 3. Parse Renders (THIS WAS MISSING)
    const rendersSheet = ss.getSheetByName('Renders');
    let renders = [];
    if (rendersSheet) {
      const rData = rendersSheet.getDataRange().getValues();
      const rHeaders = rData[0];
      for (let i = 1; i < rData.length; i++) {
        let renderObj = {};
        for (let j = 0; j < rHeaders.length; j++) {
          renderObj[rHeaders[j]] = rData[i][j];
        }
        // Only push valid rows
        if (renderObj.node_id) {
            renders.push(renderObj);
        }
      }
    }

    // Return all three objects
    return createJsonResponse({ config: config, items: items, renders: renders });
  } catch (error) {
    return createJsonResponse({ error: 'Data fetch failed: ' + error.toString() }, 500);
  }
}

function analyzeAndUpload(payload) {
  try {
    const base64Image = payload.base64Image;
    let imageID = '';

    // Handle Optional Image Upload
    if (base64Image) {
      const validBase64 = base64Image.split(',').pop();
      const blob = Utilities.newBlob(Utilities.base64Decode(validBase64), 'image/png', 'asset_' + new Date().getTime());
      const file = DriveApp.getFolderById(FOLDER_ID).createFile(blob);
      imageID = file.getId();
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    }

    // AI Analysis (If API Key is present)
    let extractedData = {};
    if (GEMINI_API_KEY && (base64Image || payload.productURL)) {
      const urlContext = payload.productURL ? `Product URL: ${payload.productURL}. ` : '';
      const promptText = `${urlContext}Extract furniture details. Return STRICTLY a valid JSON object with keys: name, price (number), dim_l, dim_w, dim_h, store (clean brand name). Use 'Unknown' or 0 if missing.`;
      
      const contents = [{ parts: [{ text: promptText }] }];
      if (base64Image) {
        contents[0].parts.push({ inline_data: { mime_type: "image/png", data: base64Image.split(',').pop() } });
      }

      const options = {
        method: 'POST',
        contentType: 'application/json',
        payload: JSON.stringify({ contents: contents }),
        muteHttpExceptions: true
      };
      
      const response = UrlFetchApp.fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, options);
      if (response.getResponseCode() === 200) {
        const jsonResponse = JSON.parse(response.getContentText());
        const textPart = jsonResponse.candidates[0].content.parts[0].text;
        extractedData = JSON.parse(textPart.replace(/```json/g, '').replace(/```/g, '').trim());
      }
    }

    return createJsonResponse({ success: true, image_id: imageID, extractedData: extractedData });
  } catch (error) {
    return createJsonResponse({ error: 'Analysis failed: ' + error.toString() }, 500);
  }
}

function saveItem(payload) {
  try {
    const item = payload.item;
    if (!item) return createJsonResponse({ error: 'No data' }, 400);

    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Items');
    const id = Utilities.getUuid();
    const timestamp = new Date();

    const newRow = [
      id, item.room || '', item.type || 'Main', item.parent_id || '', item.name || '',
      item.price || 0, item.dim_l || '', item.dim_w || '', item.dim_h || '',
      item.image_id || '', item.product_url || '', item.store || '', timestamp,
      item.is_purchased || false, item.actual_price || item.price || 0
    ];
    
    sheet.appendRow(newRow);
    return createJsonResponse({ success: true, id: id });
  } catch (error) {
    return createJsonResponse({ error: 'Save failed' }, 500);
  }
}

function updateItem(payload) {
  try {
    const item = payload.item;
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Items');
    const data = sheet.getDataRange().getValues();
    
    let rowIndex = data.findIndex((row, i) => i > 0 && row[0] === item.id);
    if (rowIndex === -1) return createJsonResponse({ error: 'Not found' }, 404);
    rowIndex += 1; // Adjust for 1-based indexing

    const headers = data[0];
    const currentRow = data[rowIndex - 1];
    const updatedRow = [...currentRow];

    headers.forEach((header, index) => {
      if (item[header] !== undefined) updatedRow[index] = item[header];
    });

    sheet.getRange(rowIndex, 1, 1, updatedRow.length).setValues([updatedRow]);
    return createJsonResponse({ success: true });
  } catch (error) {
    return createJsonResponse({ error: 'Update failed' }, 500);
  }
}

function deleteItem(payload) {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Items');
    const data = sheet.getDataRange().getValues();
    const rowIndex = data.findIndex((row, i) => i > 0 && row[0] === payload.id);
    
    if (rowIndex === -1) return createJsonResponse({ error: 'Not found' }, 404);
    
    sheet.deleteRow(rowIndex + 1);
    return createJsonResponse({ success: true });
  } catch (error) {
    return createJsonResponse({ error: 'Delete failed' }, 500);
  }
}

function uploadImage(payload) {
  try {
    const validBase64 = payload.base64Image.split(',').pop();
    const blob = Utilities.newBlob(Utilities.base64Decode(validBase64), 'image/png', 'cropped_' + new Date().getTime());
    const file = DriveApp.getFolderById(FOLDER_ID).createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return createJsonResponse({ success: true, image_id: file.getId() });
  } catch (error) {
    return createJsonResponse({ error: 'Upload failed: ' + error.toString() }, 500);
  }
}

function testRendersFetch() {
  Logger.log("Starting Test...");
  try {
    const response = getInitialData();
    const data = JSON.parse(response.getContent());
    
    if (data.renders && data.renders.length > 0) {
      Logger.log("✅ SUCCESS: Found " + data.renders.length + " render nodes.");
      Logger.log("Sample Data: " + JSON.stringify(data.renders[0]));
      Logger.log("CONCLUSION: The code works perfectly. You MUST deploy a New Version for the app to see this.");
    } else {
      Logger.log("❌ ERROR: The renders array is empty or missing.");
      Logger.log("CONCLUSION: The code is failing to read the Renders sheet. Check sheet name and headers.");
    }
  } catch (e) {
    Logger.log("❌ FATAL ERROR: " + e.toString());
  }
}