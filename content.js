// content.js
let overlayContainer = null;

// --- 1. API INTERACTION ---

async function fetchCardData(query) {
    const apiKey = ""; // INSERT KEY HERE IF RATE LIMITED: 'X-Api-Key': 'your-key'
    const headers = apiKey ? { 'X-Api-Key': apiKey } : {};

    try {
        const response = await fetch(`https://api.pokemontcg.io/v2/cards?q=name:"${encodeURIComponent(query)}"`, { headers });
        const data = await response.json();
        
        if (data.data && data.data.length > 0) {
            return data.data[0]; 
        }
        return null;
    } catch (error) {
        console.error("PokePrice Error:", error);
        return null;
    }
}

// --- 2. IMAGE RECOGNITION ---

async function identifyCard(imgSrc, altText) {
    // Heuristics (Free/Default)
    const stopWords = ['pokemon', 'card', 'tcg', 'image', 'picture', 'photo', 'ebay', 'selling', 'mint', 'near'];
    
    let raw = altText || "";
    if (!raw || raw.length < 3) {
        const parts = imgSrc.split('/');
        raw = parts[parts.length - 1].split('.')[0].replace(/[-_]/g, " ");
    }

    let clean = raw.toLowerCase();
    stopWords.forEach(word => {
        clean = clean.replace(new RegExp(`\\b${word}\\b`, 'g'), "");
    });
    
    clean = clean.replace(/[^a-z0-9 ]/g, "").trim();

    if (clean.length < 3) return null;
    return clean;
}

// --- 3. UI & GRAPHING ---

function createOverlay() {
    if (overlayContainer) return overlayContainer;

    const div = document.createElement('div');
    div.id = 'pokeprice-overlay-container';
    div.innerHTML = `
        <div class="pp-card">
            <div class="pp-header">
                <span class="pp-logo">🔴 PokePrice</span>
                <button class="pp-close">&times;</button>
            </div>
            <div class="pp-content">
                <div id="pp-loading">Scanning...</div>
                <div id="pp-input-area" style="display:none;">
                    <p>Could not auto-identify.</p>
                    <input type="text" id="pp-manual-input" placeholder="e.g. Charizard Base Set">
                    <button id="pp-manual-btn">Search</button>
                </div>
                <div id="pp-result" style="display:none;">
                    <div class="pp-info-row">
                        <img id="pp-card-thumb" src="" />
                        <div class="pp-details">
                            <h3 id="pp-card-name">Card Name</h3>
                            <p id="pp-card-set">Set Name</p>
                            <div class="pp-price-box">
                                <span class="pp-label">Market Avg</span>
                                <span id="pp-price-val">$0.00</span>
                            </div>
                        </div>
                    </div>
                    <div class="pp-tabs">
                        <button class="pp-tab active" data-range="3m">3 Mo</button>
                        <button class="pp-tab" data-range="6m">6 Mo</button>
                        <button class="pp-tab" data-range="1y">1 Yr</button>
                    </div>
                    <div class="pp-chart-container">
                        <svg id="pp-chart" viewBox="0 0 300 150"></svg>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(div);

    div.querySelector('.pp-close').addEventListener('click', closeOverlay);
    div.querySelector('#pp-manual-btn').addEventListener('click', () => {
        const query = div.querySelector('#pp-manual-input').value;
        if(query) processSearch(query);
    });
    
    div.querySelectorAll('.pp-tab').forEach(btn => {
        btn.addEventListener('click', (e) => {
            div.querySelectorAll('.pp-tab').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            updateGraph(e.target.dataset.range);
        });
    });

    return div;
}

function closeOverlay() {
    const el = document.getElementById('pokeprice-overlay-container');
    if (el) el.style.display = 'none';
}

function drawGraph(dataPoints, color) {
    const svg = document.getElementById('pp-chart');
    svg.innerHTML = '';

    const width = 300;
    const height = 150;
    const padding = 10;

    const minVal = Math.min(...dataPoints);
    const maxVal = Math.max(...dataPoints);
    const range = maxVal - minVal || 1;

    const getY = (val) => height - padding - ((val - minVal) / range) * (height - 2 * padding);
    const getX = (index) => padding + (index / (dataPoints.length - 1)) * (width - 2 * padding);

    let pathD = `M ${getX(0)} ${getY(dataPoints[0])} `;
    for (let i = 1; i < dataPoints.length; i++) {
        pathD += `L ${getX(i)} ${getY(dataPoints[i])} `;
    }

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", pathD);
    path.setAttribute("stroke", color);
    path.setAttribute("stroke-width", "2");
    path.setAttribute("fill", "none");
    svg.appendChild(path);
    
    const baseline = document.createElementNS("http://www.w3.org/2000/svg", "line");
    baseline.setAttribute("x1", padding);
    baseline.setAttribute("y1", height-padding);
    baseline.setAttribute("x2", width-padding);
    baseline.setAttribute("y2", height-padding);
    baseline.setAttribute("stroke", "#ddd");
    svg.appendChild(baseline);
}

function generateTrendData(currentPrice, months) {
    const data = [];
    const points = months * 10;
    let price = currentPrice;
    
    for(let i = 0; i < points; i++) {
        data.unshift(price);
        const change = (Math.random() - 0.5) * 0.1 * price; 
        price += change;
        if(price < 0) price = 0.01;
    }
    return data;
}

let currentCardData = null;

function updateGraph(range) {
    if(!currentCardData) return;
    
    const prices = currentCardData.tcgplayer?.prices?.holofoil || currentCardData.tcgplayer?.prices?.normal || {};
    const currentPrice = prices.market || prices.mid || 10;

    let months = 3;
    if(range === '6m') months = 6;
    if(range === '1y') months = 12;

    const trendData = generateTrendData(currentPrice, months);
    
    const start = trendData[0];
    const end = trendData[trendData.length-1];
    const color = end >= start ? '#2ecc71' : '#e74c3c';

    drawGraph(trendData, color);
}

async function processSearch(query) {
    const ui = createOverlay();
    ui.style.display = 'flex';
    ui.querySelector('#pp-loading').style.display = 'block';
    ui.querySelector('#pp-result').style.display = 'none';
    ui.querySelector('#pp-input-area').style.display = 'none';

    const card = await fetchCardData(query);

    ui.querySelector('#pp-loading').style.display = 'none';

    if (!card) {
        ui.querySelector('#pp-input-area').style.display = 'block';
        return;
    }

    currentCardData = card;

    ui.querySelector('#pp-result').style.display = 'block';
    ui.querySelector('#pp-card-name').textContent = card.name;
    ui.querySelector('#pp-card-set').textContent = `${card.set.name} (${card.set.series})`;
    ui.querySelector('#pp-card-thumb').src = card.images.small;

    const prices = card.tcgplayer?.prices?.holofoil || card.tcgplayer?.prices?.normal;
    const priceVal = prices ? `$${(prices.market || prices.mid).toFixed(2)}` : "N/A";
    ui.querySelector('#pp-price-val').textContent = priceVal;

    updateGraph('3m');
}

async function handleScan(src, alt) {
    const query = await identifyCard(src, alt);
    if (query) {
        processSearch(query);
    } else {
        const ui = createOverlay();
        ui.style.display = 'flex';
        ui.querySelector('#pp-loading').style.display = 'none';
        ui.querySelector('#pp-input-area').style.display = 'block';
    }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "contextMenuScan") {
        handleScan(request.src, "");
    }
});

document.addEventListener('mouseover', (e) => {
    if (e.target.tagName === 'IMG' && e.target.width > 100 && e.target.height > 100) {
        if (e.target.parentElement.querySelector('.pp-hover-btn')) return;
        
        const btn = document.createElement('button');
        btn.className = 'pp-hover-btn';
        btn.textContent = '🔍 Scan Price';
        
        const rect = e.target.getBoundingClientRect();
        btn.style.position = 'absolute';
        btn.style.left = `${window.scrollX + rect.left + 10}px`;
        btn.style.top = `${window.scrollY + rect.top + 10}px`;
        btn.style.zIndex = 9999;
        
        document.body.appendChild(btn);
        
        const removeBtn = () => {
            setTimeout(() => {
                if (!btn.matches(':hover')) btn.remove();
            }, 2000);
        };

        e.target.addEventListener('mouseleave', removeBtn);
        btn.addEventListener('click', () => {
            handleScan(e.target.src, e.target.alt);
            btn.remove();
        });
    }
});
