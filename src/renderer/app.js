// Global variables
let currentFile = null;
let sbomData = null;
let stage = null;
let layer = null;
let selectedNode = null;
let contextMenu = null;
let zoomLevel = 1;

// DOM elements
const welcomeScreen = document.getElementById('welcomeScreen');
const canvasContainer = document.getElementById('canvasContainer');
const loadingOverlay = document.getElementById('loadingOverlay');
const canvas = document.getElementById('canvas');
const contextMenuElement = document.getElementById('contextMenu');
const fileInfo = document.getElementById('fileInfo');
const statusInfo = document.getElementById('statusInfo');

// Buttons
const openFileBtn = document.getElementById('openFileBtn');
const welcomeOpenBtn = document.getElementById('welcomeOpenBtn');
const saveFileBtn = document.getElementById('saveFileBtn');
const saveAsBtn = document.getElementById('saveAsBtn');
const zoomInBtn = document.getElementById('zoomInBtn');
const zoomOutBtn = document.getElementById('zoomOutBtn');
const resetZoomBtn = document.getElementById('resetZoomBtn');
const fitToScreenBtn = document.getElementById('fitToScreenBtn');
const centerViewBtn = document.getElementById('centerViewBtn');

// Initialize the application
function init() {
    setupEventListeners();
    setupCanvas();
    showWelcomeScreen();
}

// Setup event listeners
function setupEventListeners() {
    openFileBtn.addEventListener('click', openFile);
    welcomeOpenBtn.addEventListener('click', openFile);
    saveFileBtn.addEventListener('click', saveFile);
    saveAsBtn.addEventListener('click', saveFileAs);
    
    // Canvas controls
    zoomInBtn.addEventListener('click', () => zoom(1.2));
    zoomOutBtn.addEventListener('click', () => zoom(0.8));
    resetZoomBtn.addEventListener('click', resetZoom);
    fitToScreenBtn.addEventListener('click', fitToScreen);
    centerViewBtn.addEventListener('click', centerView);
    
    // Context menu
    document.addEventListener('click', hideContextMenu);
    contextMenuElement.addEventListener('click', handleContextMenuClick);
    
    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
}

// Setup Konva canvas
function setupCanvas() {
    stage = new Konva.Stage({
        container: canvas,
        width: canvas.offsetWidth,
        height: canvas.offsetHeight
    });
    
    layer = new Konva.Layer();
    stage.add(layer);
    
    // Handle window resize
    window.addEventListener('resize', () => {
        stage.width(canvas.offsetWidth);
        stage.height(canvas.offsetHeight);
        if (sbomData) {
            fitToScreen();
        }
    });
}

// File operations
async function openFile() {
    try {
        showLoading();
        const result = await window.heimdallAPI.openFile();
        
        if (result) {
            currentFile = result.filePath;
            await loadSBOM(result.content);
            showCanvas();
            updateFileInfo();
        }
    } catch (error) {
        showError(`Failed to open file: ${error.message}`);
    } finally {
        hideLoading();
    }
}

async function loadSBOM(content) {
    try {
        // Try to parse as JSON first
        let data;
        try {
            data = JSON.parse(content);
        } catch {
            // If JSON fails, try XML (basic implementation)
            data = parseXMLSBOM(content);
        }
        
        // Validate CycloneDX format
        if (!data.bomFormat || !data.specVersion) {
            throw new Error('Invalid CycloneDX SBOM format');
        }
        
        sbomData = data;
        renderSBOM();
        
    } catch (error) {
        throw new Error(`Failed to parse SBOM: ${error.message}`);
    }
}

function parseXMLSBOM(xmlContent) {
    // Basic XML parsing for CycloneDX
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
    
    // Convert XML to JSON structure (simplified)
    const bom = xmlDoc.querySelector('bom');
    if (!bom) {
        throw new Error('No bom element found in XML');
    }
    
    return {
        bomFormat: bom.getAttribute('bomFormat') || 'CycloneDX',
        specVersion: bom.getAttribute('specVersion') || '1.4',
        metadata: parseMetadata(xmlDoc),
        components: parseComponents(xmlDoc)
    };
}

function parseMetadata(xmlDoc) {
    const metadata = xmlDoc.querySelector('metadata');
    if (!metadata) return {};
    
    return {
        timestamp: metadata.querySelector('timestamp')?.textContent,
        tools: Array.from(metadata.querySelectorAll('tool')).map(tool => ({
            vendor: tool.querySelector('vendor')?.textContent,
            name: tool.querySelector('name')?.textContent,
            version: tool.querySelector('version')?.textContent
        }))
    };
}

function parseComponents(xmlDoc) {
    const components = xmlDoc.querySelectorAll('component');
    return Array.from(components).map(comp => ({
        type: comp.getAttribute('type'),
        name: comp.querySelector('name')?.textContent,
        version: comp.querySelector('version')?.textContent,
        purl: comp.querySelector('purl')?.textContent,
        bomRef: comp.getAttribute('bom-ref')
    }));
}

async function saveFile() {
    if (!currentFile || !sbomData) return;
    
    try {
        const content = JSON.stringify(sbomData, null, 2);
        await window.heimdallAPI.saveFile(currentFile, content);
        showStatus('File saved successfully');
    } catch (error) {
        showError(`Failed to save file: ${error.message}`);
    }
}

async function saveFileAs() {
    if (!sbomData) return;
    
    try {
        const content = JSON.stringify(sbomData, null, 2);
        const result = await window.heimdallAPI.saveFileAs(content);
        if (result) {
            currentFile = result.filePath;
            updateFileInfo();
            showStatus('File saved successfully');
        }
    } catch (error) {
        showError(`Failed to save file: ${error.message}`);
    }
}

// SBOM Rendering
function renderSBOM() {
    layer.destroyChildren();
    
    if (!sbomData || !sbomData.components) {
        showError('No components found in SBOM');
        return;
    }
    
    const components = sbomData.components;
    const rootComponents = components.filter(comp => !comp.dependencies || comp.dependencies.length === 0);
    
    if (rootComponents.length === 0) {
        // If no root components, show all components at top level
        renderComponents(components, 0, 0, stage.width() / 2, 100);
    } else {
        renderComponents(rootComponents, 0, 0, stage.width() / 2, 100);
    }
    
    layer.draw();
    fitToScreen();
}

function renderComponents(components, level, startX, centerX, y) {
    if (!components || components.length === 0) return;
    
    const boxWidth = 200;
    const boxHeight = 80;
    const spacing = 50;
    const totalWidth = components.length * (boxWidth + spacing) - spacing;
    const startXPos = centerX - totalWidth / 2;
    
    components.forEach((component, index) => {
        const x = startXPos + index * (boxWidth + spacing);
        const componentBox = createComponentBox(component, x, y, boxWidth, boxHeight, level);
        layer.add(componentBox);
        
        // Add dependencies if they exist
        if (component.dependencies && component.dependencies.length > 0) {
            const dependentComponents = sbomData.components.filter(comp => 
                component.dependencies.includes(comp.bomRef)
            );
            
            if (dependentComponents.length > 0) {
                // Draw connection lines
                dependentComponents.forEach((dep, depIndex) => {
                    const depX = startXPos + (index + depIndex) * (boxWidth + spacing);
                    const depY = y + boxHeight + 100;
                    
                    const line = new Konva.Line({
                        points: [x + boxWidth / 2, y + boxHeight, depX + boxWidth / 2, depY],
                        stroke: '#667eea',
                        strokeWidth: 2,
                        opacity: 0.6
                    });
                    layer.add(line);
                    
                    const depBox = createComponentBox(dep, depX, depY, boxWidth, boxHeight, level + 1);
                    layer.add(depBox);
                });
            }
        }
    });
}

function createComponentBox(component, x, y, width, height, level) {
    const colors = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#00f2fe'];
    const color = colors[level % colors.length];
    
    const group = new Konva.Group({
        x: x,
        y: y
    });
    
    // Background rectangle
    const rect = new Konva.Rect({
        width: width,
        height: height,
        fill: color,
        stroke: '#fff',
        strokeWidth: 2,
        cornerRadius: 8,
        shadowColor: 'rgba(0,0,0,0.3)',
        shadowBlur: 10,
        shadowOffset: { x: 0, y: 4 },
        shadowOpacity: 0.3
    });
    
    // Component name
    const nameText = new Konva.Text({
        x: 10,
        y: 10,
        width: width - 20,
        text: component.name || component.bomRef || 'Unknown',
        fontSize: 14,
        fontFamily: 'Arial',
        fill: '#fff',
        fontWeight: 'bold',
        align: 'center'
    });
    
    // Component version
    const versionText = new Konva.Text({
        x: 10,
        y: 35,
        width: width - 20,
        text: component.version || 'No version',
        fontSize: 12,
        fontFamily: 'Arial',
        fill: '#fff',
        align: 'center',
        opacity: 0.9
    });
    
    // Component type
    const typeText = new Konva.Text({
        x: 10,
        y: 55,
        width: width - 20,
        text: component.type || 'Unknown type',
        fontSize: 10,
        fontFamily: 'Arial',
        fill: '#fff',
        align: 'center',
        opacity: 0.8
    });
    
    group.add(rect);
    group.add(nameText);
    group.add(versionText);
    group.add(typeText);
    
    // Store component data
    group.componentData = component;
    
    // Event handlers
    group.on('click', () => selectComponent(group));
    group.on('dblclick', () => expandComponent(group));
    group.on('contextmenu', (e) => showContextMenu(e, group));
    group.on('mouseenter', () => {
        document.body.style.cursor = 'pointer';
        rect.shadowBlur(20);
        layer.draw();
    });
    group.on('mouseleave', () => {
        document.body.style.cursor = 'default';
        rect.shadowBlur(10);
        layer.draw();
    });
    
    return group;
}

// Component interactions
function selectComponent(group) {
    if (selectedNode) {
        selectedNode.rect.stroke('#fff');
        selectedNode.rect.strokeWidth(2);
    }
    
    selectedNode = group;
    group.rect.stroke('#ffd700');
    group.rect.strokeWidth(3);
    layer.draw();
    
    showStatus(`Selected: ${group.componentData.name || group.componentData.bomRef}`);
}

function expandComponent(group) {
    const component = group.componentData;
    window.heimdallAPI.openDetailWindow(component, 'component');
}

// Context menu
function showContextMenu(e, group) {
    e.evt.preventDefault();
    
    contextMenu = group;
    contextMenuElement.style.left = e.evt.pageX + 'px';
    contextMenuElement.style.top = e.evt.pageY + 'px';
    contextMenuElement.classList.remove('hidden');
}

function hideContextMenu() {
    contextMenuElement.classList.add('hidden');
    contextMenu = null;
}

function handleContextMenuClick(e) {
    const action = e.target.dataset.action;
    if (!action || !contextMenu) return;
    
    const component = contextMenu.componentData;
    
    switch (action) {
        case 'open':
            window.heimdallAPI.openDetailWindow(component, 'component');
            break;
        case 'expand':
            // Expand to show dependencies
            break;
        case 'collapse':
            // Collapse dependencies
            break;
        case 'copy':
            navigator.clipboard.writeText(component.bomRef || component.name);
            showStatus('Component ID copied to clipboard');
            break;
    }
    
    hideContextMenu();
}

// Canvas controls
function zoom(factor) {
    zoomLevel *= factor;
    zoomLevel = Math.max(0.1, Math.min(5, zoomLevel));
    
    stage.scale({ x: zoomLevel, y: zoomLevel });
    stage.batchDraw();
    
    showStatus(`Zoom: ${Math.round(zoomLevel * 100)}%`);
}

function resetZoom() {
    zoomLevel = 1;
    stage.scale({ x: 1, y: 1 });
    stage.position({ x: 0, y: 0 });
    stage.batchDraw();
    showStatus('Zoom reset');
}

function fitToScreen() {
    if (!sbomData) return;
    
    const stageRect = stage.getClientRect();
    const layerRect = layer.getClientRect();
    
    const scaleX = stageRect.width / layerRect.width;
    const scaleY = stageRect.height / layerRect.height;
    const scale = Math.min(scaleX, scaleY, 1) * 0.8; // 80% of available space
    
    zoomLevel = scale;
    stage.scale({ x: scale, y: scale });
    
    // Center the content
    const scaledWidth = layerRect.width * scale;
    const scaledHeight = layerRect.height * scale;
    const x = (stageRect.width - scaledWidth) / 2;
    const y = (stageRect.height - scaledHeight) / 2;
    
    stage.position({ x: x, y: y });
    stage.batchDraw();
    
    showStatus('Fitted to screen');
}

function centerView() {
    stage.position({ x: 0, y: 0 });
    stage.batchDraw();
    showStatus('View centered');
}

// Keyboard shortcuts
function handleKeyboardShortcuts(e) {
    if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
            case 'o':
                e.preventDefault();
                openFile();
                break;
            case 's':
                e.preventDefault();
                if (e.shiftKey) {
                    saveFileAs();
                } else {
                    saveFile();
                }
                break;
        }
    } else {
        switch (e.key) {
            case '+':
            case '=':
                e.preventDefault();
                zoom(1.2);
                break;
            case '-':
                e.preventDefault();
                zoom(0.8);
                break;
            case '0':
                e.preventDefault();
                resetZoom();
                break;
            case 'f':
                e.preventDefault();
                fitToScreen();
                break;
        }
    }
}

// UI helpers
function showWelcomeScreen() {
    welcomeScreen.classList.remove('hidden');
    canvasContainer.classList.add('hidden');
    updateFileInfo();
}

function showCanvas() {
    welcomeScreen.classList.add('hidden');
    canvasContainer.classList.remove('hidden');
}

function showLoading() {
    loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
    loadingOverlay.classList.add('hidden');
}

function updateFileInfo() {
    if (currentFile) {
        const fileName = currentFile.split('/').pop() || currentFile.split('\\').pop();
        fileInfo.textContent = `File: ${fileName}`;
        saveFileBtn.disabled = false;
        saveAsBtn.disabled = false;
    } else {
        fileInfo.textContent = 'No file loaded';
        saveFileBtn.disabled = true;
        saveAsBtn.disabled = true;
    }
}

function showStatus(message) {
    statusInfo.textContent = message;
    setTimeout(() => {
        statusInfo.textContent = 'Ready';
    }, 3000);
}

function showError(message) {
    statusInfo.textContent = `Error: ${message}`;
    setTimeout(() => {
        statusInfo.textContent = 'Ready';
    }, 5000);
}

// Listen for item updates from detail windows
window.heimdallAPI.onItemUpdated((data) => {
    // Update the component in the main view
    if (sbomData && data.itemData) {
        const componentIndex = sbomData.components.findIndex(
            comp => comp.bomRef === data.itemData.bomRef
        );
        
        if (componentIndex !== -1) {
            sbomData.components[componentIndex] = { ...data.itemData, ...data.updatedData };
            renderSBOM();
            showStatus('Component updated');
        }
    }
});

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', init); 