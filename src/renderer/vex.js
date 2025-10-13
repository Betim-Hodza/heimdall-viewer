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

// ---------------------------------------------------------------
// Global variables
// ---------------------------------------------------------------
let currentItemData = null;   // VEX object we are editing
let currentItemType = null;   // should be 'vex'
let hasChanges = false;       // dirty flag – enables Save button

// ---------------------------------------------------------------
// DOM references (must match IDs in vex.html)
// ---------------------------------------------------------------
const loadingOverlay   = document.getElementById('loadingOverlay');
const detailForm       = document.getElementById('detailForm');
const detailTitle      = document.getElementById('detailTitle');
const statusInfo       = document.getElementById('statusInfo');
const validationInfo   = document.getElementById('validationInfo');

const closeBtn         = document.getElementById('closeBtn');   // always present
let   saveBtn          = document.getElementById('saveBtn');   // may be missing – we’ll add it

// ----- scalar fields -------------------------------------------------
let idInput, sourceInput, createdInput, publishedInput, updatedInput;
let descriptionInput, detailInput, recommendationInput;
let analysisInput, creditsInput, cwesInput;

// ----- collection containers -----------------------------------------
const advisoriesContainer = document.getElementById('advisoriesContainer');
const referencesContainer = document.getElementById('referencesContainer');
const ratingsContainer    = document.getElementById('ratingsContainer');
const affectsContainer    = document.getElementById('affectsContainer');

const collectionFields = {
    advisories: [
        {key: 'title',   label: 'Title',   type: 'text'},
        {key: 'url',     label: 'URL',     type: 'url'}
    ],
    references: [
        {key: 'id', label: 'ID', type: 'text'},
        {key: 'source.name', label: 'Source name', type: 'text'},
        {key: 'source.url', label: 'Source URL', type: 'url'}
    ],
    ratings: [
        {key: 'source.name', label: 'Source name', type: 'text'},
        {key: 'score', label: 'Score', type: 'number', step: '0.1'},
        {key: 'severity', label: 'Severity', type: 'text'},
        {key: 'method', label: 'Method', type: 'text'},
        {key: 'vector', label: 'Vector', type: 'text'}
    ],
    affects: [
        {key: 'ref', label: 'Reference', type: 'text'}
    ]
};

// ---------------------------------------------------------------
// Ensure a Save button exists (adds one if the HTML didn’t have it)
// ---------------------------------------------------------------
function ensureSaveButton() {
    if (saveBtn) return;               // already in the DOM

    saveBtn = document.createElement('button');
    saveBtn.id = 'saveBtn';
    saveBtn.className = 'btn btn-primary';
    saveBtn.innerHTML = '<span class="icon">💾</span> Save';
    const toolbar = document.querySelector('.toolbar');
    if (toolbar) toolbar.insertBefore(saveBtn, closeBtn);
}

// ---------------------------------------------------------------
// Init & event listeners
// ---------------------------------------------------------------
function init() {
    ensureSaveButton();
    setupEventListeners();
    listenForItemData();
}

// ---------------------------------------------------------------
function setupEventListeners() {
    // Close / Save
    if (closeBtn) closeBtn.addEventListener('click', closeWindow);
    if (saveBtn)  saveBtn.addEventListener('click', saveChanges);

    // Any input change marks the form dirty
    const allInputs = detailForm.querySelectorAll('input, textarea, select');
    allInputs.forEach(i => i.addEventListener('input', () => {
        hasChanges = true;
        if (saveBtn) saveBtn.disabled = false;
    }));

    // Prevent navigation with unsaved changes
    window.addEventListener('beforeunload', e => {
        if (hasChanges) {
            e.preventDefault();
            e.returnValue = '';
        }
    });
}

// ---------------------------------------------------------------
// Receive data from the main process (same channel as detail.js)
// ---------------------------------------------------------------
function listenForItemData() {
    window.heimdallAPI.onItemData(data => {
        currentItemData = data.itemData;
        currentItemType = data.itemType;   // should be 'vex'
        loadItemData();
    });
}

// ---------------------------------------------------------------
// Helper – safely get the current value of a field (input or span)
// ---------------------------------------------------------------
function getFieldValue(id) {
    const el = document.getElementById(id);
    if (!el) return '';
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')
        return el.value;
    return el.textContent;
}

/* -------------------------------------------------------------
   Helper – replace a placeholder element with an editable control
   ------------------------------------------------------------- */
function makeEditable(el, value) {
    if (!el) return null;

    // If it is already an input/textarea just set the value
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) {
        el.value = value ?? '';
        return el;
    }

    // Decide which element to create (textarea for multi‑line)
    const isMulti = typeof value === 'string' && value.includes('\n');
    const newEl = document.createElement(isMulti ? 'textarea' : 'input');
    newEl.id = el.id;
    newEl.className = el.className;
    newEl.value = value ?? '';

    // Replace in the DOM
    el.parentNode.replaceChild(newEl, el);
    return newEl;
}

/* -------------------------------------------------------------
   Load VEX data into the editable form
   ------------------------------------------------------------- */
function loadItemData() {
    if (!currentItemData) return;
    showLoading();

    try {
        if (currentItemType !== 'vex')
            throw new Error(`Unexpected item type "${currentItemType}"`);

        // ----- scalar fields -------------------------------------------------
        // Replace each placeholder with an editable field and keep a reference
        idInput               = makeEditable(document.getElementById('vexId'),               currentItemData.id || '');
        sourceInput           = makeEditable(document.getElementById('vexSource'),           (currentItemData.source?.name || '') + (currentItemData.source?.url ? ` (${currentItemData.source.url})` : ''));
        createdInput          = makeEditable(document.getElementById('vexCreated'),         toDateTimeLocal(currentItemData.created));
        publishedInput        = makeEditable(document.getElementById('vexPublished'),       toDateTimeLocal(currentItemData.published));
        updatedInput          = makeEditable(document.getElementById('vexUpdated'),         toDateTimeLocal(currentItemData.updated));

        descriptionInput      = makeEditable(document.getElementById('vexDescription'),   currentItemData.description || '');
        detailInput           = makeEditable(document.getElementById('vexDetail'),        currentItemData.detail || '');
        recommendationInput   = makeEditable(document.getElementById('vexRecommendation'),currentItemData.recommendation || '');

        // Analysis – we render it as a simple textarea with one line per property
        const analysisObj = currentItemData.analysis || {};
        const analysisText = [
            `state: ${analysisObj.state || ''}`,
            `justification: ${analysisObj.justification || ''}`,
            `response: ${Array.isArray(analysisObj.response) ? analysisObj.response.join(', ') : ''}`,
            `detail: ${analysisObj.detail || ''}`
        ].join('\n');
        analysisInput = makeEditable(document.getElementById('vexAnalysis'), analysisText);

        // Credits & CWEs ----------------------------------------------------
        const creditsNames = (currentItemData.credits?.individuals || []).map(i => i.name).join(', ');
        creditsInput   = makeEditable(document.getElementById('vexCredits'), creditsNames);
        cwesInput      = makeEditable(document.getElementById('vexCwes'),    (currentItemData.cwes || []).join(', '));

        // ----- collections ----------------------------------------------------
        renderCollectionEditors('advisories',   currentItemData.advisories   || [], renderAdvisoryRow);
        renderCollectionEditors('references',   currentItemData.references   || [], renderReferenceRow);
        renderCollectionEditors('ratings',      currentItemData.ratings      || [], renderRatingRow);
        renderCollectionEditors('affects',      currentItemData.affects      || [], renderAffectRow);

        // Title and UI state
        detailTitle.textContent = `VEX Details – ${currentItemData.id || ''}`;
        hasChanges = false;
        if (saveBtn) saveBtn.disabled = true;
        showForm();

    } catch (err) {
        showError(`Failed to load VEX data: ${err.message}`);
    } finally {
        hideLoading();
    }
}

/* -------------------------------------------------------------
   Date helpers – convert ISO ↔ datetime-local format
   ------------------------------------------------------------- */
function toDateTimeLocal(iso) {
    if (!iso) return '';
    // Keep YYYY‑MM‑DDTHH:MM (drop seconds & timezone)
    return iso.replace(/\.\d+Z$/, '').replace('Z', '').slice(0, 16);
}
function fromDateTimeLocal(val) {
    if (!val) return '';
    return new Date(val).toISOString();
}

/* -------------------------------------------------------------
   Collection rendering helpers
   ------------------------------------------------------------- */
function renderCollectionEditors(name, items, rowRenderer) {
    const container = {
        advisories: advisoriesContainer,
        references: referencesContainer,
        ratings:    ratingsContainer,
        affects:    affectsContainer
    }[name];

    container.innerHTML = '';
    items.forEach((item, idx) => container.appendChild(rowRenderer(item, idx)));

    // Add‑button (only once)
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'btn btn-secondary';
    addBtn.textContent = `+ Add ${name.slice(0, -1)}`;   // singular
    addBtn.addEventListener('click', () => openCollectionEditor(name));
    container.appendChild(addBtn);
}

/* ---------- ROW RENDERERS (advisory, reference, rating, affect) ---------- */
function renderAdvisoryRow(item, idx) {
    const row = document.createElement('div');
    row.className = 'list-row';
    row.innerHTML = `
        <input type="text" class="advisory-title" placeholder="Title" value="${escapeHTML(item.title||'')}" data-idx="${idx}">
        <input type="url" class="advisory-url" placeholder="URL" value="${escapeHTML(item.url||'')}" data-idx="${idx}">
        <button type="button" class="remove-advisory">✖</button>
    `;
    row.querySelector('.remove-advisory').addEventListener('click', () => removeFromCollection('advisories', idx));
    row.querySelectorAll('input').forEach(i => i.addEventListener('input', () => hasChanges = true));
    return row;
}

function renderReferenceRow(item, idx) {
    const row = document.createElement('div');
    row.className = 'list-row';
    row.innerHTML = `
        <input type="text" class="reference-id" placeholder="ID" value="${escapeHTML(item.id||'')}" data-idx="${idx}">
        <input type="text" class="reference-src-name" placeholder="Source Name" value="${escapeHTML(item.source?.name||'')}" data-idx="${idx}">
        <input type="url" class="reference-src-url" placeholder="Source URL" value="${escapeHTML(item.source?.url||'')}" data-idx="${idx}">
        <button type="button" class="remove-reference">✖</button>
    `;
    row.querySelector('.remove-reference').addEventListener('click', () => removeFromCollection('references', idx));
    row.querySelectorAll('input').forEach(i => i.addEventListener('input', () => hasChanges = true));
    return row;
}

function renderRatingRow(item, idx) {
    const row = document.createElement('div');
    row.className = 'list-row';
    row.innerHTML = `
        <input type="text" class="rating-src" placeholder="Source" value="${escapeHTML(item.source?.name||'')}" data-idx="${idx}">
        <input type="number" step="0.1" class="rating-score" placeholder="Score" value="${item.score ?? ''}" data-idx="${idx}">
        <input type="text" class="rating-sev" placeholder="Severity" value="${escapeHTML(item.severity||'')}" data-idx="${idx}">
        <input type="text" class="rating-method" placeholder="Method"HTML(item.method||'')}" data-idx="${idx}">
        <input type="text" class="rating-vector" placeholder="Vector" value="${escapeHTML(item.vector||'')}" data-idx="${idx}">
        <button type="button" class="remove-rating">✖</button>
    `;
    row.querySelector('.remove-rating').addEventListener('click', () => removeFromCollection('ratings', idx));
    row.querySelectorAll('input').forEach(i => i.addEventListener('input', () => hasChanges = true));
    return row;
}

function renderAffectRow(item, idx) {
    const row = document.createElement('div');
    row.className = 'list-row';
    row.innerHTML = `
        <input type="text" class="affect-ref" placeholder="Reference" value="${escapeHTML(item.ref||'')}" data-idx="${idx}">
        <button type="button" class="remove-affect">✖</button>
    `;
    row.querySelector('.remove-affect').addEventListener('click', () => removeFromCollection('affects', idx));
    row.querySelectorAll('input').forEach(i => i.addEventListener('input', () => hasChanges = true));
    return row;
}

/* -------------------------------------------------------------
   Remove an item from a collection and re‑render that collection.
   ------------------------------------------------------------- */
function removeFromCollection(name, idx) {
    if (!Array.isArray(currentItemData[name])) return;
    currentItemData[name].splice(idx, 1);
    renderCollectionEditors(name, currentItemData[name],
        {advisories: renderAdvisoryRow, references: renderReferenceRow,
         ratings: renderRatingRow, affects: renderAffectRow}[name]);
    hasChanges = true;
    if (saveBtn) saveBtn.disabled = false;
}

/* -------------------------------------------------------------
   Prompt‑based editor for adding a new collection item.
   (Replace with a modal if you prefer a richer UI.)
   ------------------------------------------------------------- */
function openCollectionEditor(collectionName) {
    const fields = collectionFields[collectionName]
    
    if (!fields) {
        console.warn('No Field deff for collection', collectionName);
    }

    const container = {
        advisories: advisoriesContainer,
        references: referencesContainer,
        ratings:    ratingsContainer,
        affects:    affectsContainer
    }[collectionName];

    const tempRow = document.createElement('div');
    tempRow.className = 'list-row new-item';

     const actions = document.createElement('span');
    actions.className = 'list-actions';
    actions.style.marginLeft = '8px';

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.textContent = 'Add';
    addBtn.style.marginRight = '4px';
    addBtn.addEventListener('click', () => {
        // ----- Build the new item object from the inputs -----
        const newItem = {};
        tempRow.querySelectorAll('input').forEach(inp => {
            const path = inp.dataset.key.split('.');
            setNested(newItem, path, inp.value.trim());
        });

        // Normalise structures that need nesting
        if (collectionName === 'references') {
            newItem.source = {
                name: newItem.source?.name || '',
                url:  newItem.source?.url  || ''
            };
        }
        if (collectionName === 'ratings') {
            newItem.score = parseFloat(newItem.score) || undefined;
        }

        // ----- Insert into the data model and re‑render ----------
        if (!Array.isArray(currentItemData[collectionName])) {
            currentItemData[collectionName] = [];
        }
        currentItemData[collectionName].push(newItem);
        renderCollectionEditors(collectionName,
            currentItemData[collectionName],
            {
                advisories: renderAdvisoryRow,
                references: renderReferenceRow,
                ratings:    renderRatingRow,
                affects:    renderAffectRow
            }[collectionName]);

        hasChanges = true;
        if (saveBtn) saveBtn.disabled = false;
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => {
        tempRow.remove();
    });

    actions.appendChild(addBtn);
    actions.appendChild(cancelBtn);
    tempRow.appendChild(actions);

    container.insertBefore(tempRow, container.firstChild);
}

/* -------------------------------------------------------------
   Utility – set a nested property given an array of keys.
   ------------------------------------------------------------- */
function setNested(obj, keys, value) {
    const last = keys.pop();
    let cur = obj;
    for (const k of keys) {
        if (!cur[k]) cur[k] = {};
        cur = cur[k];
    }
    cur[last] = value;
}

/* -------------------------------------------------------------
   Utility – HTML‑escape a string for safe attribute insertion.
   ------------------------------------------------------------- */
function escapeHTML(str) {
    return (str ?? '').replace(/&/g, '&amp;')
                     .replace(/"/g, '&quot;')
                     .replace(/'/g, '&#39;')
                     .replace(/</g, '&lt;')
                     .replace(/>/g, '&gt;');
}

/* -------------------------------------------------------------
   Save – build a fresh VEX object from the edited fields and
   push it back to the main window (app.js already listens on
   `onItemUpdated`).
   ------------------------------------------------------------- */
async function saveChanges() {
    try {
        // ----- parse the combined source string (name (url)) -----
        const sourceRaw = getFieldValue('vexSource').trim();
        let srcName = '', srcUrl = '';
        const match = sourceRaw.match(/^(.+?)\s*\((https?:\/\/[^\)]+)\)$/);
        if (match) {
            srcName = match[1].trim();
            srcUrl  = match[2].trim();
        } else {
            srcName = sourceRaw;   // fallback – treat whole string as name
        }

        // ----- parse analysis textarea back into an object -----
        const analysisLines = getFieldValue('vexAnalysis').split('\n');
        const analysis = {};
        analysisLines.forEach(line => {
            const [key, ...rest] = line.split(':');
            if (!key) return;
            const val = rest.join(':').trim();
            switch (key.trim().toLowerCase()) {
                case 'state':        analysis.state = val; break;
                case 'justification':analysis.justification = val; break;
                case 'response':     analysis.response = val ? val.split(',').map(s=>s.trim()) : []; break;
                case 'detail':       analysis.detail = val; break;
            }
        });

        // ----- Build the updated VEX object -----------------------
        const updated = {
            id:            getFieldValue('vexId').trim(),
            source:        { name: srcName, url: srcUrl },
            created:       fromDateTimeLocal(getFieldValue('vexCreated')),
            published:     fromDateTimeLocal(getFieldValue('vexPublished')),
            updated:       fromDateTimeLocal(getFieldValue('vexUpdated')),
            description:   getFieldValue('vexDescription').trim(),
            detail:        getFieldValue('vexDetail').trim(),
            recommendation:getFieldValue('vexRecommendation').trim(),
            analysis:      analysis,
            credits: {
                individuals: getFieldValue('vexCredits')
                              .split(',')
                              .map(n=>({name:n.trim()}))
                              .filter(i=>i.name)
            },
            cwes: (getFieldValue('vexCwes')
                    .split(',')
                    .map(v=>parseInt(v.trim(),10))
                    .filter(Number.isFinite))
        };

        // Collections – they have already been mutated in‑place
        updated.advisories = currentItemData.advisories || [];
        updated.references = currentItemData.references || [];
        updated.ratings    = currentItemData.ratings    || [];
        updated.affects    = currentItemData.affects    || [];

        // ----- Tell the main window that this VEX entry changed -----
        // app.js registers `window.heimdallAPI.onItemUpdated(...)`
        await window.heimdallAPI.onItemUpdated({
            itemData:   updated,
            itemType:   'vex',
            // we also pass the entire SBOM so the main window can persist it
            parentSbom: window.opener ? window.opener.sbomData : null
        });

        hasChanges = false;
        if (saveBtn) saveBtn.disabled = true;
        showStatus('VEX entry saved');
        // optional: close the window automatically
        // window.close();

    } catch (err) {
        showError(`Failed to save VEX: ${err.message}`);
    }
}

/* -------------------------------------------------------------
   UI helper functions (unchanged except a tiny fix)
   ------------------------------------------------------------- */
function closeWindow() {
    if (hasChanges) {
        const ok = confirm('You have unsaved changes. Are you sure you want to close?');
        if (!ok) return;
    }
    window.close();
}
function showLoading()    { loadingOverlay.classList.remove('hidden'); }
function hideLoading()    { loadingOverlay.classList.add('hidden'); }
function showForm()       { detailForm.classList.remove('hidden'); }
function showStatus(msg) {
    statusInfo.textContent = msg;
    setTimeout(() => statusInfo.textContent = 'Ready', 3000);
}
function showError(msg) {
    statusInfo.textContent = `Error: ${msg}`;
    setTimeout(() => statusInfo.textContent = 'Ready', 5000);
}
function showValidationErrors(errs) {
    validationInfo.textContent = errs.join(', ');
    validationInfo.classList.remove('valid');
}
function hideValidationErrors() {
    validationInfo.textContent = '';
    validationInfo.classList.add('valid');
}

/* -------------------------------------------------------------
   Initialise when the page loads
   ------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', init);
