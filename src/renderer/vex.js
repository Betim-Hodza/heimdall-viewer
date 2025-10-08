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

// global
let currentItemData = null;
let currentItemType = null;
let hasChanges      = false;


const loadingOverlay      = document.getElementById('loadingOverlay');
const detailForm          = document.getElementById('detailForm');
const detailTitle         = document.getElementById('detailTitle');
const statusInfo          = document.getElementById('statusInfo');
const validationInfo      = document.getElementById('validationInfo');

// Buttons
const closeBtn            = document.getElementById('closeBtn');
const saveBtn             = document.getElementById('saveBtn');

// VEX‑specific fields 
const idVex               = document.getElementById('vexId');
const sourceVex           = document.getElementById('vexSource');
const createdVex          = document.getElementById('vexCreated');
const publishedVex        = document.getElementById('vexPublished');
const updatedVex          = document.getElementById('vexUpdated');
const descriptionVex      = document.getElementById('vexDescription');
const detailVex           = document.getElementById('vexDetail');
const recommendationVex   = document.getElementById('vexRecommendation');
const analysisVex         = document.getElementById('vexAnalysis');
const creditsVex          = document.getElementById('vexCredits');
const cwesVex             = document.getElementById('vexCwes');

// Containers for VEX collections
const advisoriesContainer = document.getElementById('advisoriesContainer');
const referencesContainer = document.getElementById('referencesContainer');
const ratingsContainer    = document.getElementById('ratingsContainer');
const affectsContainer    = document.getElementById('affectsContainer');


function init() {
    setupEventListeners();
    listenForItemData();
}

function setupEventListeners() {
    if (closeBtn) {
        closeBtn.addEventListener('click', closeWindow);
    }

    if (saveBtn) {
        saveBtn.addEventListener('click', saveChanges);
    } 

    window.addEventListener('beforeunload', e => {
        if (hasChanges) {
            e.preventDefault();
            e.returnValue = '';
        }
    });
}

// get vex data 
function listenForItemData() {
    window.heimdallAPI.onItemData(data => {
        currentItemData = data.itemData;
        currentItemType = data.itemType; // should be 'vex'
        loadItemData();
    });
}

// loading vex data
function loadItemData() {
    if (!currentItemData) return;
    showLoading();

    try {
        if (currentItemType === 'vex') {
            // fields 
            idVex.textContent            = currentItemData.id               || '';
            sourceVex.textContent        = (currentItemData.source?.name || '') +
                                           (currentItemData.source?.url ? ` (${currentItemData.source.url})` : '');
            createdVex.textContent       = currentItemData.created          || '';
            publishedVex.textContent     = currentItemData.published        || '';
            updatedVex.textContent       = currentItemData.updated          || '';
            descriptionVex.textContent   = currentItemData.description      || '';
            detailVex.textContent        = currentItemData.detail           || '';
            recommendationVex.textContent = currentItemData.recommendation   || '';
            cwesVex.textContent          = (currentItemData.cwes || []).join(', ');

            // analysis (flattened) 
            if (currentItemData.analysis) {
                const a = currentItemData.analysis;
                analysisVex.textContent = `State: ${a.state || ''}` +
                                          (a.justification ? `, Justification: ${a.justification}` : '') +
                                          (a.response ? `, Response: ${a.response.join(', ')}` : '') +
                                          (a.detail ? `\n${a.detail}` : '');
            }


            if (currentItemData.credits?.individuals) {
                const names = currentItemData.credits.individuals.map(i => i.name).join(', ');
                creditsVex.textContent = names;
            }

            // collections
            
            // Advisories
            advisoriesContainer.innerHTML = '';
            (currentItemData.advisories || []).forEach(a => {
                const link = a.url ? `<a href="${a.url}" target="_blank">${a.title}</a>` : a.title;
                advisoriesContainer.appendChild(createListRow('Advisory', link));
            });

            // References
            referencesContainer.innerHTML = '';
            (currentItemData.references || []).forEach(r => {
                const src  = r.source?.name ? ` (${r.source.name})` : '';
                const link = r.source?.url ? `<a href="${r.source.url}" target="_blank">Source</a>` : '';
                const txt  = `${r.id || ''}${src} ${link}`;
                referencesContainer.appendChild(createListRow('Reference', txt));
            });

            // Ratings
            ratingsContainer.innerHTML = '';
            (currentItemData.ratings || []).forEach(r => {
                const src = r.source?.name ? `${r.source.name}` : '';
                const txt = `Score: ${r.score ?? ''}, Severity: ${r.severity ?? ''}, Method: ${r.method ?? ''}, Vector: ${r.vector ?? ''}`;
                const lbl = src ? `${src} rating` : 'Rating';
                ratingsContainer.appendChild(createListRow(lbl, txt));
            });

            // Affects
            affectsContainer.innerHTML = '';
            (currentItemData.affects || []).forEach(a => {
                affectsContainer.appendChild(createListRow('Affects', a.ref || ''));
            });

            detailTitle.textContent = `VEX Details – ${currentItemData.id || ''}`;
        } else {
            // If for some reason a non‑VEX type reaches this window,
            // just show a "friendly" message.
            detailTitle.textContent = `Unsupported item type (${currentItemType})`;
            console.warn('vex.js received unexpected item type:', currentItemType);
        }

        hasChanges = false;
        showForm();

    } catch (err) {
        showError(`Failed to load ${currentItemType}: ${err.message}`);
    } finally {
        hideLoading();
    }
}

// generic list for collections
function createListRow(label, value) {
    const row = document.createElement('div');
    row.className = 'list-row';
    row.innerHTML = `
        <span class="list-label">${label}:</span>
        <span class="list-value">${value}</span>
    `;
    return row;
}

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
    validationInfo.join(', ');
    validationInfo.classList.remove('valid');
}
function hideValidationErrors() {
    validationInfo.textContent = '';
    validationInfo.classList.add('valid');
}

document.addEventListener('DOMContentLoaded', init);