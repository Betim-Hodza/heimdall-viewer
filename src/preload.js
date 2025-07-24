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

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('heimdallAPI', {
  // File operations
  openFile: () => ipcRenderer.invoke('open-file'),
  saveFile: (filePath, content) => ipcRenderer.invoke('save-file', { filePath, content }),
  saveFileAs: (content) => ipcRenderer.invoke('save-file-as', content),
  
  // Window management
  openDetailWindow: (itemData, itemType) => ipcRenderer.invoke('open-detail-window', { itemData, itemType }),
  updateItem: (itemData, itemType, updatedData) => ipcRenderer.invoke('update-item', { itemData, itemType, updatedData }),
  
  // Event listeners
  onItemData: (callback) => ipcRenderer.on('item-data', (event, data) => callback(data)),
  onItemUpdated: (callback) => ipcRenderer.on('item-updated', (event, data) => callback(data)),
  
  // Remove listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
}); 