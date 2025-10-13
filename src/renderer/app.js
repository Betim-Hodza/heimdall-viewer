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
// Global variables
let currentFile = null;
let sbomData = null;
let stage = null;
let layer = null;
let selectedNode = null;
let selectedNodes = [];
let contextMenu = null;
let zoomLevel = 1;
let sbomExpanded = false;
let expandedComponents = new Set(); // Track which components are expanded

// Selection box variables
let selectionBox = null;
let isSelecting = false;
let selectionStartPos = null;

// Pan variables
let isPanning = false;
let panStartPos = null;

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
    
    // Add context menu handler for canvas background
    stage.on('contextmenu', (e) => {
        // Only show context menu if clicking on empty space (not on a component)
        if (e.target === stage) {
            showContextMenu(e, null);
        }
    });
    
    // Mouse event handlers for selection and panning
    stage.on('mousedown', (e) => {
        // Only handle left-click on empty space
        if (e.target === stage && e.evt.button === 0) {
            // Deselect all items when clicking on empty canvas
            deselectAll();
            
            // Check if we should start selection or panning
            if (e.evt.shiftKey) {
                // Shift+click starts panning
                startPanning(e);
            } else {
                // Regular click starts selection
                startSelection(e);
            }
        } else if (e.target === stage && e.evt.button === 1) {
            // Middle-click pans the canvas
            startPanning(e);
        }
    });


    // update selection as the mouse moves
    stage.on('mousemove', (e) => {
        if (isSelecting) {
            updateSelection(e);
        } else if (isPanning) {
            updatePanning(e);
        }
    });

    // selection of items    
    stage.on('mouseup', (e) => {
        if (isSelecting) {
            endSelection(e);
        } else if (isPanning) {
            endPanning(e);
        }
    });

    // zoom canvas in and out w/ mouse wheel
    stage.on('wheel', (e) => {
        zoom(e.evt.deltaY < 0 ? 1.2 : 0.8);
    })
}

// File operations
async function openFile() {
    try {
        showLoading();
        console.log('Opening file...');
        const result = await window.heimdallAPI.openFile();
        
        if (result) {
            console.log('File opened successfully:', result.filePath);
            console.log('Content length:', result.content.length);
            currentFile = result.filePath;
            await loadSBOM(result.content);
            showCanvas();
            updateFileInfo();
        } else {
            console.log('No file selected');
        }
    } catch (error) {
        console.error('Error opening file:', error);
        showError(`Failed to open file: ${error.message}`);
    } finally {
        hideLoading();
    }
}

async function loadSBOM(content) {
    try {
        console.log('Loading SBOM content:', content.substring(0, 200) + '...');
        
        // Try to parse as JSON first
        let data;
        try {
            data = JSON.parse(content);
            console.log('Successfully parsed as JSON');
        } catch (jsonError) {
            console.log('JSON parsing failed, trying XML:', jsonError.message);
            // If JSON fails, try XML (basic implementation)
            data = parseXMLSBOM(content);
        }
        
        console.log('Parsed data structure:', {
            bomFormat: data.bomFormat,
            specVersion: data.specVersion,
            hasComponents: !!data.components,
            hasVulnerabilities: !!data.vulnerabilities,
            componentCount: data.components ? data.components.length : 0,
            vulnerabilitiesCount: data.vulnerabilities ? data.vulnerabilities.length : 0
        });
        
        // Validate CycloneDX format
        if (!data.bomFormat || !data.specVersion) {
            throw new Error('Invalid CycloneDX SBOM format - missing bomFormat or specVersion');
        }

        
        sbomData = data;

        
        if (sbomData && Array.isArray(sbomData.components)) {
            sbomData.components.forEach((c, idx) => {
                // If the component already has a bomRef – keep it.
                // Otherwise generate a deterministic one based on the purl or name.
                if (!c.bomRef) {
                    if (c.purl) {
                        // Use a URL‑safe version of the purl
                        c.bomRef = encodeURIComponent(c.purl);
                    } else {
                        // Fallback – component‑index‑<N>
                        c.bomRef = `component-${idx}-${Date.now()}`;
                    }
                }
            });
        }
        
        // Reset expansion state when loading new SBOM
        sbomExpanded = false;
        expandedComponents.clear();
        
        // Add a small delay to ensure canvas is ready
        setTimeout(() => {
            renderSBOM();
        }, 100);
        
    } catch (error) {
        console.error('SBOM parsing error:', error);
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
        components: parseComponents(xmlDoc),
        vulnerabilities: parseVulnerabilities(xmlDoc)
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

function parseVulnerabilities(xmlDoc) {
    const vulns = xmlDoc.querySelectorAll('vulnerabilities');
    console.log(vulns);
    return Array.from(vulns).map(vuln => ({
        id: vuln.querySelector('id')?.textContent,
        source: vuln.querySelector('source')?.textContent,
        references: vuln.querySelector('references')?.textContent,
        ratings: vuln.querySelector('ratings')?.textContent,
        cwe: vuln.querySelector('cwe')?.textContent,
        description: vuln.querySelector('description')?.textContent,
        detail: vuln.querySelector('detail')?.textContent,
        recommendation: vuln.querySelector('recommendation')?.textContent,
        advisories: vuln.querySelector('advisories')?.textContent,
        created: vuln.querySelector('created')?.textContent,
        published: vuln.querySelector('published')?.textContent,
        updated: vuln.querySelector('updated')?.textContent,
        credits: vuln.querySelector('credits')?.textContent,
        analysis: vuln.querySelector('analysis')?.textContent,
        affects: vuln.querySelector('affects')?.textContent,
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
    console.log('Rendering SBOM...');
    console.log('Canvas dimensions:', canvas ? `${canvas.offsetWidth}x${canvas.offsetHeight}` : 'canvas not found');
    console.log('Stage dimensions:', stage ? `${stage.width()}x${stage.height()}` : 'stage not found');
    
    // Ensure canvas dimensions are properly set before rendering
    if (stage && canvas) {
        const canvasWidth = canvas.offsetWidth;
        const canvasHeight = canvas.offsetHeight;
        
        console.log('Setting stage dimensions to:', `${canvasWidth}x${canvasHeight}`);
        
        if (canvasWidth > 0 && canvasHeight > 0) {
            stage.width(canvasWidth);
            stage.height(canvasHeight);
        } else {
            console.warn('Canvas has zero dimensions, using fallback values');
            stage.width(800);
            stage.height(600);
        }
    }
    
    console.log('Before destroyChildren - layer children count:', layer.children.length);
    layer.destroyChildren();
    console.log('After destroyChildren - layer children count:', layer.children.length);
    
    if (!sbomData) {
        showError('No SBOM data found');
        return;
    }
    
    // Create SBOM root node
    const sbomBox = createSBOMBox(stage.width() / 2, 50);
    layer.add(sbomBox);
    console.log('After adding SBOM box - layer children count:', layer.children.length);
    
    // Only render components if expanded
    console.log('renderSBOM - sbomExpanded:', sbomExpanded);
    console.log('renderSBOM - components count:', sbomData.components ? sbomData.components.length : 0);
    console.log('renderSBOM - vulnerabilities count:', sbomData.vulnerabilities ? sbomData.vulnerabilities.length : 0);

    if (sbomExpanded) {
        const rootX = stage.width() / 2;
        const rootY = 150;          // bottom centre of the SBOM box (50 + 100)

        // ── Components ─────────────────────────────────────
        if (sbomData.components && sbomData.components.length) {
            console.log('Rendering component hierarchy');
            renderHierarchy(
                sbomData.components,
                1,                     // level
                rootX,
                rootY,
                "component",
                null
            );
        }

        // ── Vulnerabilities ─────────────────────────────────
        if (sbomData.vulnerabilities && sbomData.vulnerabilities.length) {
            console.log('Rendering top‑level (orphan) vulnerability hierarchy');

            // Only render VEX entries that are **not** attached to a component.
            const orphanVulns = getOrphanVulnerabilities();

            if (orphanVulns.length) {
                // Shift the orphan tree down a bit so it doesn’t overlap the component tree
                const vulnOffsetY = rootY + 200; // 200 px lower than the component tree
                renderHierarchy(
                    orphanVulns,
                    1,
                    rootX,
                    vulnOffsetY,
                    "vulnerability",
                    null                // no parent node for top‑level VEX
                );
            } else {
                console.log('No orphan VEX entries – all vulnerabilities are attached to components');
            }
        }
    } else {
        console.log('SBOM collapsed – only root is shown');
    }
    
    console.log('Before layer.draw() - layer children count:', layer.children.length);
    layer.draw();
    console.log('After layer.draw() - layer children count:', layer.children.length);
    
    // Ensure proper z-index ordering: lines behind components
    layer.children.forEach(child => {
        if (child instanceof Konva.Line) {
            child.moveToBottom();
        }
    });
    
    // Only set initial zoom and position if this is the first render
    if (zoomLevel === 1 && stage.position().x === 0 && stage.position().y === 0) {
        // Set initial zoom to 1 for normal size
        zoomLevel = 1;
        stage.scale({ x: 1, y: 1 });
        stage.position({ x: 0, y: 0 });
        stage.batchDraw();
    }
}

function getOrphanVulnerabilities() {
    if (!Array.isArray(sbomData.vulnerabilities)) return [];

    return sbomData.vulnerabilities.filter(vuln => {
        // If the VEX has no `affects` array or it is empty → orphan
        if (!Array.isArray(vuln.affects) || vuln.affects.length === 0) return true;

        // Build a list of all component references (bomRef | purl | name)
        const compRefs = sbomData.components?.map(getComponentReference) || [];

        // If none of the refs in `vuln.affects` match a component → orphan
        return !vuln.affects.some(a => compRefs.includes(a.ref));
    });
}

function addConnectionLine(parentX, parentY, childX, childY, childWidth, childHeigth) {
    const line = new Konva.Line({
        points: [parentX, parentY, childX + childWidth / 2, childY],
        stroke: '#667eea',
        strokeWidth: 2,
        opacity: 0.6
    });
    layer.add(line);
    return line;
}

function renderHierarchy(items, level, parentX, parentY, type, parentNode = null) {
    if (!items || items.length === 0) return;
    if (!sbomExpanded) {
        console.log('SBOM not expanded – abort hierarchy render');
        return;
    }

    // ---------- Layout constants ----------
    const boxWidth   = 200;
    const boxHeight  = 80;
    const spacing    = 50;
    const levelHeight = 120;

    // total width the row would occupy (including spacing)
    const totalWidth = items.length * (boxWidth + spacing) - spacing;

    // ----- Determine start X (centre‑aligned but kept inside canvas) -----
    const canvasW = stage.width();
    let startX = parentX - totalWidth / 2;

    // keep a 20‑px gutter on both sides
    startX = Math.max(20, Math.min(startX, canvasW - totalWidth - 20));

    // if the row would overflow, shrink spacing (never below 10 px)
    const actualSpacing = totalWidth > canvasW - 40
        ? Math.max(10, (canvasW - 40 - items.length * boxWidth) / (items.length - 1))
        : spacing;

    // Y‑coordinate for this level – never drop below the bottom gutter
    const canvasH = stage.height();
    const y = Math.min(parentY + levelHeight, canvasH - boxHeight - 20);

    // ---------- Draw every node ----------
    items.forEach((item, idx) => {
        const x = startX + idx * (boxWidth + actualSpacing);

        // connection line (always behind the node)
        const line = addConnectionLine(
            parentX,
            level === 1 ? 150 : parentY,    // parent bottom Y
            x,
            y,
            boxWidth,
            boxHeight
        );

        // the actual box (different factory per type)
        const box = createSubBox(item, x, y, boxWidth, boxHeight, level, type);

        // store relationship info for drag updates
        box.connectionLine = line;
        box.parentX = parentX;
        box.parentY = parentY;
        box.level   = level;
        box.parentNode = parentNode;       // <-- NEW – reference to the live parent

        // enable drag → keep line attached
        box.on('dragmove', () => {
            updateConnectionLine(box);
            // -------------------------------------------------
            // Propagate the update to any *descendants* of this node
            // -------------------------------------------------
            layer.children.forEach(ch => {
                if (ch.parentNode && isDescendant(ch, box)) {
                    updateConnectionLine(ch);
                }
            });
        });

        // -------------------------------------------------
        // Recursively render *dependencies* (components only)
        // -------------------------------------------------
        if (type === 'component' && item.dependencies && item.dependencies.length > 0
            && expandedComponents.has(item.bomRef)) {
            const dependent = sbomData.components.filter(c =>
                item.dependencies.includes(c.bomRef)
            );
            if (dependent.length) {
                renderHierarchy(
                    dependent,
                    level + 1,
                    x + boxWidth / 2,
                    y + boxHeight + levelHeight,
                    type,
                    box                     // parentNode = this component
                );
            }
        }

        // RenderEX children that reference THIS component
        // -------------------------------------------------
        if (type === 'component' && Array.isArray(sbomData.vulnerabilities)) {
            const childVulns = sbomData.vulnerabilities.filter(vuln => {
                if (!Array.isArray(vuln.affects)) return false;
                const compRef = getComponentReference(item);
                return vuln.affects.some(a => a.ref === compRef);
            });

            if (childVulns.length) {
                const compBottom = getNodeBottomCenter(box);
                renderHierarchy(
                    childVulns,
                    level + 1,
                    compBottom.x,
                    compBottom.y,
                    'vulnerability',
                    box                     // parentNode = this component
                );
            }
        }

        layer.add(box);
    });
}

function createSubBox(item, x, y, width, height, level, type) {
    const compColors = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#00f2fe'];
    const vulnColors = ['#6e89ffff', '#bb78ffff', '#f9c7ffff', '#ff8393ff', '#88c8ffff', '#8bf9ffff'];
    // pick color based on type and level
    const color = type === "component" ? compColors[level % compColors.length] : vulnColors[level % vulnColors.length];
    
    
    const group = new Konva.Group({
        x: x,
        y: y,
        draggable: true
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
    if (type === "component") {
        // Component name
        const nameText = new Konva.Text({
            x: 10,
            y: 10,
            width: width - 20,
            text: item.name || item.bomRef || 'Unknown',
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
            text: item.version || 'No version',
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
            text: item.type || 'Unknown type',
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
        group.componentData = item;
        group.componentRef  = getComponentReference(item);   
        group.isComponent = true;
        
        // Event handlers
        group.on('click', (e) => handleComponentClick(e, group));
        group.on('dblclick', () => expandComponent(group));
        group.on('contextmenu', (e) => showContextMenu(e, group));
    } else if (type === "vulnerability") {
        // CVE ID
        const idText = new Konva.Text({
            x: 10,
            y: 10,
            width: width - 20,
            text: item.id || 'Unknown',
            fontSize: 14,
            fontFamily: 'Arial',
            fill: '#fff',
            fontWeight: 'bold',
            align: 'center'
        });

        // Vulnerability State
        const stateText = new Konva.Text({
            x: 10,
            y: 35,
            width: width - 20,
            text: item.analysis.state || 'No State',
            fontSize: 12,
            fontFamily: 'Arial',
            fill: '#fff',
            align: 'center',
            opacity: 0.9
        });
        

        // avg rating calculation
        sum_rating = 0;
        for (var i = 0; i < item.ratings.length; i++) {
            sum_rating += item.ratings[i].score;
        }
        average_rating = sum_rating / item.ratings.length;

        // Vulnerability Rating
        const ratingText = new Konva.Text({
            x: 10,
            y: 55,
            width: width - 20,
            text: "average rating: " + average_rating.toFixed(2) || 'Unknown rating',
            fontSize: 10,
            fontFamily: 'Arial',
            fill: '#fff',
            align: 'center',
            opacity: 0.8
        });
        
        group.add(rect);
        group.add(idText);
        group.add(stateText);
        group.add(ratingText);
        
        // Store component data
        group.vulnData = item;
        group.isVuln = true;
        
        // Event handlers
        group.on('click', (e) => handleVulnClick(e, group));
        group.on('dblclick', () => expandVulnerability(group));
        group.on('contextmenu', (e) => showContextMenu(e, group));
    }
    
    group.on('dragstart', () => {
        // Store initial position for multi-selection dragging
        group.setAttr('lastX', group.x());
        group.setAttr('lastY', group.y());
    });
    group.on('dragmove', () => {
        // If this component is part of a selection, move all selected components together
        if (selectedNodes.length > 1 && selectedNodes.includes(group)) {
            const dx = group.x() - group.getAttr('lastX');
            const dy = group.y() - group.getAttr('lastY');
            
            selectedNodes.forEach(selectedNode => {
                if (selectedNode !== group) {
                    const newX = selectedNode.x() + dx;
                    const newY = selectedNode.y() + dy;
                    
                    // Constrain to canvas boundaries
                    const maxX = stage.width() - width;
                    const maxY = stage.height() - height;
                    
                    selectedNode.x(Math.max(0, Math.min(maxX, newX)));
                    selectedNode.y(Math.max(0, Math.min(maxY, newY)));
                    
                    updateConnectionLine(selectedNode);
                }
            });
        }
        
        // Constrain the dragged component to canvas boundaries
        const x = group.x();
        const y = group.y();
        const maxX = stage.width() - width;
        const maxY = stage.height() - height;
        
        if (x < 0) group.x(0);
        if (y < 0) group.y(0);
        if (x > maxX) group.x(maxX);
        if (y > maxY) group.y(maxY);
        
        // Store current position for next drag move
        group.setAttr('lastX', group.x());
        group.setAttr('lastY', group.y());
        
        updateConnectionLine(group);
    });
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

// Create SBOM root box
function createSBOMBox(centerX, y) {
    const width = 300;
    const height = 100;
    const x = centerX - width / 2;
    
    // Get application name from root component
    let appName = 'Software Bill of Materials';
    if (sbomData.metadata && sbomData.metadata.component) {
        appName = sbomData.metadata.component.name || appName;
    }
    
    const group = new Konva.Group({
        x: x,
        y: y,
        draggable: true
    });
    
    // Background rectangle
    const rect = new Konva.Rect({
        width: width,
        height: height,
        fill: '#4facfe',
        stroke: '#fff',
        strokeWidth: 3,
        cornerRadius: 12,
        shadowColor: 'rgba(0,0,0,0.3)',
        shadowBlur: 15,
        shadowOffset: { x: 0, y: 6 },
        shadowOpacity: 0.4
    });
    
    // SBOM title
    const titleText = new Konva.Text({
        x: 10,
        y: 15,
        width: width - 20,
        text: appName,
        fontSize: 18,
        fontFamily: 'Arial',
        fill: '#fff',
        fontWeight: 'bold',
        align: 'center'
    });
    
    // SBOM metadata
    const metadataText = new Konva.Text({
        x: 10,
        y: 45,
        width: width - 20,
        text: `${sbomData.bomFormat} v${sbomData.specVersion}`,
        fontSize: 14,
        fontFamily: 'Arial',
        fill: '#fff',
        align: 'center',
        opacity: 0.9
    });
    
    // Component count
    const countText = new Konva.Text({
        x: 10,
        y: 65,
        width: width - 20,
        text: `${sbomData.components ? sbomData.components.length : 0} Components`,
        fontSize: 12,
        fontFamily: 'Arial',
        fill: '#fff',
        align: 'center',
        opacity: 0.8
    });

    // Vuln count
    const vulnCount = new Konva.Text({
        x: 10,
        y: 80,
        width: width - 20,
        text: `${sbomData.vulnerabilities ? sbomData.vulnerabilities.length : 0} VEX`,
        fontSize: 12,
        fontFamily: 'Arial',
        fill: '#fff',
        align: 'center',
        opacity: 0.8
    });
    
    group.add(rect);
    group.add(titleText);
    group.add(metadataText);
    group.add(countText);
    group.add(vulnCount);
    
    // Store SBOM data
    group.sbomData = sbomData;
    group.isSBOMRoot = true;
    
    // Event handlers
    group.on('click', (e) => handleComponentClick(e, group));
    group.on('dblclick', () => toggleSBOM(group));
    group.on('contextmenu', (e) => showContextMenu(e, group));
    group.on('dragmove', () => {
        // Constrain to canvas boundaries
        const x = group.x();
        const y = group.y();
        const maxX = stage.width() - width;
        const maxY = stage.height() - height;

        if (x < 0) group.x(0);
        if (y < 0) group.y(0);
        if (x > maxX) group.x(maxX);
        if (y > maxY) group.y(maxY);

        // Update **all** lines on the canvas (components, sub‑components, VEX, …)
        refreshAllLines();
    });
    group.on('mouseenter', () => {
        document.body.style.cursor = 'pointer';
        rect.shadowBlur(25);
        layer.draw();
    });
    group.on('mouseleave', () => {
        document.body.style.cursor = 'default';
        rect.shadowBlur(15);
        layer.draw();
    });
    
    return group;
}

// Component interactions
function handleComponentClick(e, group) {
    // Don't handle clicks if we're in selection mode
    if (isSelecting) {
        return;
    }
    
    const isCtrlClick = e.evt.ctrlKey || e.evt.metaKey;
    
    if (isCtrlClick) {
        // Multi-selection with Ctrl/Cmd+click
        const index = selectedNodes.indexOf(group);
        if (index > -1) {
            // Deselect
            selectedNodes.splice(index, 1);
            const rect = group.findOne('Rect');
            if (rect) {
                rect.stroke('#fff');
                rect.strokeWidth(2);
            }
        } else {
            // Select
            selectedNodes.push(group);
            const rect = group.findOne('Rect');
            if (rect) {
                rect.stroke('#ffd700');
                rect.strokeWidth(3);
            }
        }
        
        if (selectedNodes.length === 0) {
            selectedNode = null;
        } else if (selectedNodes.length === 1) {
            selectedNode = selectedNodes[0];
        }
        
        showStatus(`Selected ${selectedNodes.length} component(s)`);
    } else {
        // Single selection
        // Clear previous selections
        deselectAll();
        
        selectedNodes = [group];
        selectedNode = group;
        
        const rect = group.findOne('Rect');
        if (rect) {
            rect.stroke('#ffd700');
            rect.strokeWidth(3);
        }
        

        if (group.isSBOMRoot) {
            showStatus(`Selected: SBOM (${sbomData.components ? sbomData.components.length : 0} components) and (${sbomData.vulnerabilities ? sbomData.vulnerabilities.length : 0} VEX)`);
        } else if (group.isComponent) {
            showStatus(`Selected: ${group.componentData.name || group.componentData.bomRef}`);
        } else if (group.isVuln) {
            showStatus(`Selected: ${group.vexData.id}`);
        } 
    }
    
    layer.draw();
}

// Component interactions
function handleVulnClick(e, group) {
    // Don't handle clicks if we're in selection mode
    if (isSelecting) {
        return;
    }
    
    const isCtrlClick = e.evt.ctrlKey || e.evt.metaKey;
    
    if (isCtrlClick) {
        // Multi-selection with Ctrl/Cmd+click
        const index = selectedNodes.indexOf(group);
        if (index > -1) {
            // Deselect
            selectedNodes.splice(index, 1);
            const rect = group.findOne('Rect');
            if (rect) {
                rect.stroke('#fff');
                rect.strokeWidth(2);
            }
        } else {
            // Select
            selectedNodes.push(group);
            const rect = group.findOne('Rect');
            // if (rect) {
            //     rect.stroke('#ff9900ff');
            //     rect.strokeWidth(3);
            // }
        }
        
        if (selectedNodes.length === 0) {
            selectedNode = null;
        } else if (selectedNodes.length === 1) {
            selectedNode = selectedNodes[0];
        }
        
        showStatus(`Selected ${selectedNodes.length} VEX(s)`);
    } else {
        // Single selection
        // Clear previous selections
        deselectAll();
        
        selectedNodes = [group];
        selectedNode = group;
        
        const rect = group.findOne('Rect');
        if (rect) {
            rect.stroke('#ff9900ff');
            rect.strokeWidth(3);
        }
        
        if (group.isSBOMRoot) {
            showStatus(`Selected: SBOM (${sbomData.vulnerabilities ? sbomData.vulnerabilities.length : 0} VEX)`);
        } else {
            showStatus(`Selected: ${group.vulnData.nameText || group.vulnData.bomRef}`);
        }
    }
    
    layer.draw();
}

function addVexToTarget(target) {
    console.log("adding vex to target", target);
    if (!sbomData) {
        showError('No SBOM loaded – cannot add a VEX entry');
        return;
    }
    if (!Array.isArray(sbomData.vulnerabilities)) {
        sbomData.vulnerabilities = [];
    }

    // -----------------------------------------------------------------
    // Build a minimal VEX entry – details will be filled later.
    // -----------------------------------------------------------------
    const ts = new Date().toISOString().split('T')[0];   // YYYY‑MM‑DD
    const newVuln = {
        id:            `VULN-${Date.now()}`,   // temporary id – editable later
        source:         { name: 'Custom', url: '' },
        description:    '',
        detail:         '',
        recommendation: '',
        created:        ts,
        published:      ts,
        updated:        ts,
        analysis: {
            state:        'reported',
            justification:'',
            response:     [],
            detail:       ''
        },
        credits:       { individuals: [] },
        cwes:          [],
        advisories:    [],
        references:    [],
        ratings:       [],
        affects:       []          // will be filled if we have a component target
    };

    // -----------------------------------------------------------------
    // Attach the reference to the component we right‑clicked.
    // -----------------------------------------------------------------
    if (target && target.componentData) {
        const ref = getComponentReference(target.componentData);
        if (ref) {
            newVuln.affects.push({ ref });
        } else {
            console.warn('Component has no identifiable reference – VEX will be orphaned');
        }
    }

    // -----------------------------------------------------------------
    // Persist and refresh the canvas.
    // -----------------------------------------------------------------
    sbomData.vulnerabilities.push(newVuln);
    renderSBOM();                         // redraw the view
    showStatus(`Added new vulnerability ${newVuln.id}`);

    // Open the detail editor so the user can fill in the fields.
    window.heimdallAPI.openVexWindow(newVuln, 'vex');
}

function expandSBOM(group) {
    console.log('Expanding SBOM');
    sbomExpanded = true;
    showStatus('SBOM expanded - showing all components');
    console.log('SBOM expanded - expandedComponents size:', expandedComponents.size);
    
    // Re-render with updated expansion state
    renderSBOM();
}

function collapseSBOM(group) {
    console.log('Collapsing SBOM');
    sbomExpanded = false;
    showStatus('SBOM collapsed - showing only root');
    // Clear all expanded components when collapsing SBOM
    expandedComponents.clear();
    console.log('Cleared expandedComponents - size now:', expandedComponents.size);
    
    // Re-render with updated expansion state
    renderSBOM();
}

function toggleSBOM(group) {
    console.log('Toggling SBOM expansion');
    if (sbomExpanded) {
        collapseSBOM(group);
    } else {
        expandSBOM(group);
    }
}

function expandSBOMToFit(group) {
    console.log('Expanding SBOM to fit canvas');
    sbomExpanded = true;
    
    // Re-render with updated expansion state
    renderSBOM();
    showStatus('SBOM expanded');
}

function expandComponentToFit(group) {
    console.log('Expanding component to fit canvas');
    // For now, just expand the SBOM and fit to screen
    expandSBOMToFit(group);
}

function collapseComponent(group) {
    const component = group.componentData;
    console.log('Collapsing component:', component);
    
    if (expandedComponents.has(component.bomRef)) {
        expandedComponents.delete(component.bomRef);
        showStatus(`Collapsed ${component.name}`);
        renderSBOM();
    } else {
        showStatus(`${component.name} is already collapsed`);
    }
}

function collapseAllComponents() {
    console.log('Collapsing all components');
    expandedComponents.clear();
    showStatus('All components collapsed');
    renderSBOM();
}

function expandComponent(group) {
    const component = group.componentData;
    console.log('Expanding component:', component);
    
    // First, ensure SBOM is expanded
    if (!sbomExpanded) {
        sbomExpanded = true;
        showStatus('SBOM expanded to show components');
    }
    
    // Check if this component has dependencies
    if (component.dependencies && component.dependencies.length > 0) {
        console.log('Component has dependencies:', component.dependencies);
        // Find dependent components
        const dependentComponents = sbomData.components.filter(comp => 
            component.dependencies.includes(comp.bomRef)
        );
        
        console.log('Found dependent components:', dependentComponents);
        
        if (dependentComponents.length > 0) {
            // Toggle expansion state
            if (expandedComponents.has(component.bomRef)) {
                expandedComponents.delete(component.bomRef);
                showStatus(`Collapsed ${component.name}`);
            } else {
                expandedComponents.add(component.bomRef);
                showStatus(`Expanded ${component.name} - showing ${dependentComponents.length} dependencies`);
            }
            
            // Re-render to show/hide dependencies
            renderSBOM();
        } else {
            showStatus(`No dependencies found for ${component.name}`);
        }
    } else {
        console.log('Component has no dependencies');
        // No dependencies, just open detail window
        window.heimdallAPI.openDetailWindow(component, 'component');
    }
}

function expandVulnerability(group) {
    const vuln = group.vulnData;
    console.log('Expanding vuln:', vuln);
    console.log(vuln)
    
    // First, ensure SBOM is expanded
    if (!sbomExpanded) {
        sbomExpanded = true;
        showStatus('SBOM expanded to show vulns');
    }

    
    window.heimdallAPI.openVexWindow(vuln, "vex");
}


// Context menu
function showContextMenu(e, group) {
    e.evt.preventDefault();
    
    contextMenu = group;
    contextMenuElement.style.left = e.evt.pageX + 'px';
    contextMenuElement.style.top = e.evt.pageY + 'px';
    
    // Update context menu items based on current state
    updateContextMenuItems(group);
    
    contextMenuElement.classList.remove('hidden');
}

function updateContextMenuItems(group) {
    const expandItem = contextMenuElement.querySelector('[data-action="expand"]');
    const collapseItem = contextMenuElement.querySelector('[data-action="collapse"]');
    
    if (!group) {
        // Clicking on empty space - show general options
        expandItem.style.display = 'none';
        collapseItem.style.display = 'none';
    } else if (group.isSBOMRoot) {
        // For SBOM root, toggle between expand/collapse
        if (sbomExpanded) {
            expandItem.style.display = 'none';
            collapseItem.style.display = 'block';
        } else {
            expandItem.style.display = 'block';
            collapseItem.style.display = 'none';
        }
    } else if (group.isComponent) {
        // For components, show both options
        expandItem.style.display = 'block';
        collapseItem.style.display = 'block';
    } else if (group.isVuln) {
        console.log("isvuln")
        expandItem.style.display = 'none';
        collapseItem.style.display = 'none';
    }
}

function hideContextMenu() {
    contextMenuElement.classList.add('hidden');
    contextMenu = null;
}

function handleContextMenuClick(e) {
    const action = e.target.dataset.action;
    if (!action || !contextMenu) return;
    
    if (contextMenu.isSBOMRoot) {
        // Handle SBOM root actions
        switch (action) {
            case 'open':
                // Open SBOM details
                window.heimdallAPI.openDetailWindow(sbomData, 'sbom');
                break;
            case 'expand':
                expandSBOM(contextMenu);
                break;
            case 'expandToFit':
                expandSBOMToFit(contextMenu);
                break;
            case 'collapse':
                collapseSBOM(contextMenu);
                break;
            case 'save':
                saveChangesToFile();
                break;
            case 'copy':
                navigator.clipboard.writeText('SBOM');
                showStatus('SBOM reference copied to clipboard');
                break;
            case 'addVex':
                // need to create a new vulnerabilities part in reference to this specific component
                addVexToTarget(null);
        }
    } else if (contextMenu.isComponent) {
        // Handle component actions
        const component = contextMenu.componentData;
        
        switch (action) {
            case 'open':
                window.heimdallAPI.openDetailWindow(component, 'component');
                break;
            case 'expand':
                expandComponent(contextMenu);
                break;
            case 'expandToFit':
                expandComponentToFit(contextMenu);
                break;
            case 'collapse':
                collapseComponent(contextMenu);
                break;
            case 'save':
                saveChangesToFile();
                break;
            case 'copy':
                navigator.clipboard.writeText(component.bomRef || component.name);
                showStatus('Component ID copied to clipboard');
                break;
            case 'addVex':
                // need to create a new vulnerabilities part in reference to this specific component
                addVexToTarget(contextMenu);
        }
    } else if (contextMenu.isVuln) {
        // Handle vulnerability actions
        const vulnerability = contextMenu.vulnData;
        console.log(vulnerability)

        switch (action) {
            case 'open':
                window.heimdallAPI.openVexWindow(vulnerability, 'vulnerability');
                break;
            case 'save':
                saveChangesToFile();
                break;
            case 'copy':
                navigator.clipboard.writeText(vulnerability.id);
                showStatus('Vuln ID copied to clipboard');
                break;
        }
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
    
    // Add padding to ensure components don't touch edges
    const padding = 50;
    const availableWidth = stageRect.width - (padding * 2);
    const availableHeight = stageRect.height - (padding * 2);
    
    const scaleX = availableWidth / layerRect.width;
    const scaleY = availableHeight / layerRect.height;
    const scale = Math.min(scaleX, scaleY, 1); // Don't scale down if not needed
    
    zoomLevel = scale;
    stage.scale({ x: scale, y: scale });
    
    // Center the content with padding
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

function moveSelectedComponents(dx, dy) {
    if (selectedNodes.length > 0) {
        selectedNodes.forEach(node => {
            const currentX = node.x();
            const currentY = node.y();
            const newX = Math.max(0, Math.min(stage.width() - 200, currentX + dx));
            const newY = Math.max(0, Math.min(stage.height() - 80, currentY + dy));
            node.position({ x: newX, y: newY });
            updateConnectionLine(node);
        });
        layer.batchDraw();
        showStatus(`Moved ${selectedNodes.length} component(s)`);
    }
}

function updateConnectionLine(node) {
    if (!node.connectionLine) return;

    const boxX = node.x();
    const boxY = node.y();
    const boxWidth  = 200;
    const boxHeight = 80;

    let parentX, parentY;

    // If the node knows its live parent, use that.
    // Otherwise fall back to the original logic.
    if (node.parentNode) {
        const parentPos = getNodeBottomCenter(node.parentNode);
        parentX = parentPos.x;
        parentY = parentPos.y;
    } else if (node.level === 1) {
        // Level‑1 nodes connect to the SBOM root
        const sbomBox = layer.children.find(child => child.isSBOMRoot);
        if (sbomBox) {
            parentX = sbomBox.x() + 150;   // SBOM centre X
            parentY = sbomBox.y() + 100;   // SBOM bottom Y
        } else {
            // Fallback – use stored values
            parentX = node.parentX;
            parentY = node.parentY + 100;
        }
    } else {
        // Nodes without a live parent (should not happen) – use stored coords
        parentX = node.parentX;
        parentY = node.parentY + 80;
    }

    node.connectionLine.points([
        parentX,
        parentY,
        boxX + boxWidth / 2,
        boxY
    ]);

    // Ensure line stays behind components
    node.connectionLine.moveToBottom();
    node.connectionLine.draw();
}

function updateSBOMConnectionLines(sbomBox) {
    refreshAllLines();
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
            case 'ArrowUp':
                e.preventDefault();
                moveSelectedComponents(0, -10);
                break;
            case 'ArrowDown':
                e.preventDefault();
                moveSelectedComponents(0, 10);
                break;
            case 'ArrowLeft':
                e.preventDefault();
                moveSelectedComponents(-10, 0);
                break;
            case 'ArrowRight':
                e.preventDefault();
                moveSelectedComponents(10, 0);
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
    
    // Reinitialize canvas dimensions after showing the container
    // Use requestAnimationFrame to ensure the DOM has updated
    requestAnimationFrame(() => {
        if (stage) {
            stage.width(canvas.offsetWidth);
            stage.height(canvas.offsetHeight);
        }
    });
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

    // Bail out early if we don't have a SBOM loaded
    if (!sbomData) {
        console.warn('onItemUpdated received but no SBOM is loaded');
        return;
    }

    // component updates
    if (data.itemType === 'component') {
        const compIdx = sbomData.components?.findIndex(
            c => c.bomRef === data.itemData.bomRef
        );

        if (compIdx >= 0) {
            sbomData.components[compIdx] = {
                ...sbomData.components[compIdx],
                ...data.itemData
            };
            showStatus('Component updated');
        } else {
            console.warn('Component not found in SBOM during update', data.itemData);
        }

        // vex updates
    } else if (data.itemType === 'vex') {
        // Ensure the SBOM actually has a vulnerabilities array
        if (!Array.isArray(sbomData.vulnerabilities)) {
            sbomData.vulnerabilities = [];
        }

        // Find the vulnerability by its **id** (the only unique key we have)
        const vexIdx = sbomData.vulnerabilities.findIndex(v => v.id === data.itemData.id);

        if (vexIdx >= 0) {
            // Replace the existing entry with the newly‑saved one
            sbomData.vulnerabilities[vexIdx] = {
                ...sbomData.vulnerabilities[vexIdx],
                ...data.itemData
            };
            showStatus(`VEX "${data.itemData.id}" updated`);
        } else {
            // If the VEX entry does not exist yet (should not happen for an edit,
            // but it covers the “add new VEX” case when the canvas was not expanded)
            sbomData.vulnerabilities.push(data.itemData);
            showStatus(`VEX "${data.itemData.id}" added`);
        }

        // Force the VEX hierarchy to be visible – otherwise the canvas may
        // still be showing the component view only.
        if (!sbomExpanded) {
            sbomExpanded = true;                 // expand the SBOM automatically
            showStatus('SBOM expanded – VEX now visible');
        }


    } else {
        console.warn('onItemUpdated received unknown itemType', data.itemType);
    }

    renderSBOM();

    saveChangesToFile();
});

// Save changes back to the original file
async function saveChangesToFile() {
    if (currentFile && sbomData) {
        try {
            const content = JSON.stringify(sbomData, null, 2);
            await window.heimdallAPI.saveFile(currentFile, content);
            showStatus('Changes saved to file');
        } catch (error) {
            showError(`Failed to save changes: ${error.message}`);
        }
    }
}

// Selection box functions
function deselectAll() {
    // Clear previous selections
    selectedNodes.forEach(node => {
        const rect = node.findOne('Rect');
        if (rect) {
            rect.stroke('#fff');
            rect.strokeWidth(2);
        }
    });
    
    selectedNodes = [];
    selectedNode = null;
    showStatus('Ready');
    layer.draw();
}

function updateSelectionFromBox(startX, startY, endX, endY) {
    // Find components within the selection box
    const selectedComponents = [];
    const selectedVulns = [];
    layer.children.forEach(child => {
        if (child.isComponent || child.isSBOMRoot || child.isVuln) {
            // Convert component position to stage coordinates
            const childPos = child.getAbsolutePosition();
            const childRect = child.getClientRect();
            
            // Check if component intersects with selection box
            if (childPos.x + childRect.width >= startX && 
                childPos.x <= endX &&
                childPos.y + childRect.height >= startY && 
                childPos.y <= endY) {
                (child.isComponent || child.isSBOMRoot) ? selectedComponents.push(child) : selectedVulns.push(child);
            }
        }
    });
    
    // First, deselect all components that are no longer in the selection box
    selectedNodes.forEach(node => {
        if (!selectedComponents.includes(node)) {
            const rect = node.findOne('Rect');
            if (rect) {
                rect.stroke('#fff');
                rect.strokeWidth(2);
            }
        }
        if (!selectedVulns.includes(node)) {
            const rect = node.findOne('Rect');
            if (rect) {
                rect.stroke('#fff');
                rect.strokeWidth(2);
            }
        }
    });
    
    // Then, select all components that are in the selection box
    selectedComponents.forEach(node => {
        const rect = node.findOne('Rect');
        if (rect) {
            rect.stroke('#ffd700');
            rect.strokeWidth(3);
        }
    });
    selectedVulns.forEach(node => {
        const rect = node.findOne('Rect');
        if (rect) {
            rect.stroke('#ff9900ff');
            rect.strokeWidth(3);
        }
    });
    
    // Update the selected nodes array and append components and vuln
    selectedNodes = selectedComponents.concat(selectedVulns);
    selectedNode = selectedComponents.length > 0 ? selectedComponents[0] : null;
    
    // Update status
    if (selectedComponents.length > 0 && selectedVulns.length > 0) {
        showStatus(`Selected ${selectedComponents.length} component(s) and ${selectedVulns.length} vulnerability(ies)`);
    }else if (selectedComponents.length > 0) {
        showStatus(`Selected ${selectedComponents.length} component(s)`);
    } else if (selectedVulns.length > 0) {
        showStatus(`Selected ${selectedVulns.length} vulnerability(ies)`);
    } else {
        showStatus('Ready');
    }
}

function startSelection(e) {
    const pos = stage.getPointerPosition();
    isSelecting = true;
    selectionStartPos = pos;
    
    // Clear any existing selections when starting a new selection box
    deselectAll();
    
    // Convert stage coordinates to layer coordinates
    const layerPos = layer.getTransform().copy().invert().point(pos);
    
    // Create selection box using layer coordinates
    selectionBox = new Konva.Rect({
        x: layerPos.x,
        y: layerPos.y,
        width: 0,
        height: 0,
        stroke: '#0096fd',
        strokeWidth: 2,
        dash: [5, 5],
        fill: 'rgba(0, 150, 253, 0.1)'
    });
    
    layer.add(selectionBox);
    layer.draw();
}

function updateSelection(e) {
    if (!isSelecting || !selectionBox || !selectionStartPos) return;
    
    const pos = stage.getPointerPosition();
    
    // Convert stage coordinates to layer coordinates
    const layerTransform = layer.getTransform().copy().invert();
    const layerPos = layerTransform.point(pos);
    const layerStartPos = layerTransform.point(selectionStartPos);
    
    const startX = Math.min(layerStartPos.x, layerPos.x);
    const startY = Math.min(layerStartPos.y, layerPos.y);
    const width = Math.abs(layerPos.x - layerStartPos.x);
    const height = Math.abs(layerPos.y - layerStartPos.y);
    
    selectionBox.x(startX);
    selectionBox.y(startY);
    selectionBox.width(width);
    selectionBox.height(height);
    
    // Update selection in real-time as the box changes
    // Convert back to stage coordinates for component intersection testing
    const stageStartX = Math.min(selectionStartPos.x, pos.x);
    const stageStartY = Math.min(selectionStartPos.y, pos.y);
    const stageEndX = Math.max(selectionStartPos.x, pos.x);
    const stageEndY = Math.max(selectionStartPos.y, pos.y);
    updateSelectionFromBox(stageStartX, stageStartY, stageEndX, stageEndY);
    
}

function endSelection(e) {
    if (!isSelecting || !selectionBox || !selectionStartPos) return;
    
    // Finalize the selection based on the current box
    const pos = stage.getPointerPosition();
    const layerTransform = layer.getTransform().copy().invert();
    const layerPos = layerTransform.point(pos);
    const layerStartPos = layerTransform.point(selectionStartPos);


    const startX = Math.min(layerStartPos.x, layerPos.x);
    const startY = Math.min(layerStartPos.y, layerPos.y);
    const endX = Math.max(layerStartPos.x, layerPos.x);
    const endY = Math.max(layerStartPos.y, layerPos.y);
    
    // Final update of selection
    updateSelectionFromBox(startX, startY, endX, endY);
    
    // Clean up selection box
    if (selectionBox) {
        selectionBox.destroy();
        selectionBox = null;
    }
    
    isSelecting = false;
    selectionStartPos = null;
    layer.draw();
}

// Panning functions
function startPanning(e) {
    const pos = stage.getPointerPosition();
    isPanning = true;
    panStartPos = pos;
    
    // Change cursor to indicate panning
    document.body.style.cursor = 'grabbing';
}

function updatePanning(e) {
    if (!isPanning || !panStartPos) return;
    
    const pos = stage.getPointerPosition();
    const dx = pos.x - panStartPos.x;
    const dy = pos.y - panStartPos.y;
    
    // Move the layer (which contains all components)
    const currentPos = layer.position();
    layer.position({
        x: currentPos.x + dx,
        y: currentPos.y + dy
    });
    
    // Update the pan start position for the next move
    panStartPos = pos;
    

}

function endPanning(e) {
    if (!isPanning) return;
    
    isPanning = false;
    panStartPos = null;
    
    // Reset cursor
    document.body.style.cursor = 'default';
}

function getNodeBottomCenter(node) {
    const boxWidth  = 200;
    const boxHeight = 80;
    return {
        x: node.x() + boxWidth / 2,
        y: node.y() + boxHeight          // bottom edge of the rectangle
    };
}

function getComponentReference(comp) {
    if (!comp) return null;
    return comp.bomRef || comp.purl || comp.name || null;
}

function isDescendant(node, ancestor) {
    if (!node || !ancestor) return false;
    if (node === ancestor) return true;
    return isDescendant(node.parentNode, ancestor);
}

function refreshAllLines() {
    layer.children.forEach(child => {
        if (child.connectionLine) {
            updateConnectionLine(child);
        }
    });
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', init); 