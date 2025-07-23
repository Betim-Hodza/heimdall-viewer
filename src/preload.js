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