/*
Copyright 2025 The Heimdall Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let detailWindows = new Map();

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    title: 'Heimdall Viewer',
    icon: path.join(__dirname, 'assets', 'icon.png')
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createDetailWindow(itemData, itemType) {
  const detailWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    title: `${itemType} Details - ${itemData.name || itemData.id || 'Unknown'}`,
    parent: mainWindow,
    modal: false
  });

  detailWindow.loadFile(path.join(__dirname, 'renderer', 'detail.html'));
  
  detailWindow.webContents.on('did-finish-load', () => {
    detailWindow.webContents.send('item-data', { itemData, itemType });
  });

  const windowId = Date.now().toString();
  detailWindows.set(windowId, detailWindow);

  detailWindow.on('closed', () => {
    detailWindows.delete(windowId);
  });

  return windowId;
}

app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC handlers
ipcMain.handle('open-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'CycloneDX Files', extensions: ['json', 'xml'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0];
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return { filePath, content };
    } catch (error) {
      throw new Error(`Failed to read file: ${error.message}`);
    }
  }
  return null;
});

ipcMain.handle('save-file', async (event, { filePath, content }) => {
  try {
    fs.writeFileSync(filePath, content, 'utf8');
    return { success: true };
  } catch (error) {
    throw new Error(`Failed to save file: ${error.message}`);
  }
});

ipcMain.handle('save-file-as', async (event, content) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'XML Files', extensions: ['xml'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (!result.canceled) {
    try {
      fs.writeFileSync(result.filePath, content, 'utf8');
      return { success: true, filePath: result.filePath };
    } catch (error) {
      throw new Error(`Failed to save file: ${error.message}`);
    }
  }
  return null;
});

ipcMain.handle('open-detail-window', async (event, { itemData, itemType }) => {
  return createDetailWindow(itemData, itemType);
});

ipcMain.handle('update-item', async (event, { itemData, itemType, updatedData }) => {
  // Notify main window about the update
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('item-updated', { itemData, itemType, updatedData });
  }
  return { success: true };
}); 