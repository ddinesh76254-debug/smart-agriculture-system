/**
 * AGROPULSE AI — ENTERPRISE PRECISION AGTECH FRONTEND CONTROLLER
 * Full SPA Navigation, Theme Management, Leaflet GIS, ML Inference,
 * AI Disease Scanner, Yield & ROI Calculator, AgroBot AI & Real-Time Weather
 */

const API_BASE = '';
let currentFarmer = null;
let liveWeatherData = null;
let gisMap = null;
let mapLayers = {};
let activePlotId = 'plot-a';
let charts = {};

// Farm Plot Database (Synced with backend / fallback)
const PLOTS_DATA = {
  'plot-a': {
    id: 'plot-a',
    name: 'Plot A — North Acre',
    crop: 'Cotton (Bt-II)',
    acres: 4.5,
    soil_type: 'Black Clay Loam',
    moisture: 58,
    ph: 6.8,
    n: 85,
    p: 48,
    k: 52,
    ndvi: 0.76,
    health: 'Optimal',
    valve_status: 'IDLE',
    valve_last_run: 'Today, 05:30 AM',
    coords: [21.1478, 79.0885],
    polygon: [
      [21.1465, 79.0860],
      [21.1495, 79.0865],
      [21.1490, 79.0910],
      [21.1460, 79.0905]
    ]
  },
  'plot-b': {
    id: 'plot-b',
    name: 'Plot B — Riverbed Field',
    crop: 'Wheat (Sharbati)',
    acres: 3.0,
    soil_type: 'Alluvial Loam',
    moisture: 42,
    ph: 7.1,
    n: 65,
    p: 38,
    k: 45,
    ndvi: 0.62,
    health: 'Needs Irrigation',
    valve_status: 'RUNNING',
    valve_last_run: 'Active (15m remaining)',
    coords: [21.1445, 79.0905],
    polygon: [
      [21.1435, 79.0880],
      [21.1460, 79.0885],
      [21.1455, 79.0930],
      [21.1430, 79.0925]
    ]
  },
  'plot-c': {
    id: 'plot-c',
    name: 'Plot C — Greenhouse 01',
    crop: 'Hydroponic Tomatoes',
    acres: 1.0,
    soil_type: 'Coco Peat / Perlite',
    moisture: 72,
    ph: 6.4,
    n: 110,
    p: 60,
    k: 80,
    ndvi: 0.88,
    health: 'Thriving',
    valve_status: 'AUTO-TIMED',
    valve_last_run: 'Scheduled 14:00',
    coords: [21.1488, 79.0935],
    polygon: [
      [21.1478, 79.0920],
      [21.1500, 79.0925],
      [21.1498, 79.0950],
      [21.1475, 79.0945]
    ]
  }
};

// Soil Presets for Quick Testing
const SOIL_PRESETS = {
  black_cotton: { n: 120, p: 48, k: 52, ph: 7.2, moisture: 55, name: "Black Cotton Soil (Deccan)" },
  alluvial_grain: { n: 85, p: 45, k: 42, ph: 6.8, moisture: 60, name: "Alluvial Fertile Loam (Plains)" },
  red_sandy: { n: 35, p: 60, k: 75, ph: 6.2, moisture: 38, name: "Red Sandy Loam (Legumes/Pulses)" },
  arid_dryland: { n: 25, p: 22, k: 40, ph: 7.8, moisture: 25, name: "Arid Semi-Dryland (Pomegranate/Melon)" },
  coastal_humid: { n: 95, p: 55, k: 45, ph: 6.0, moisture: 75, name: "Coastal Humid Wet (Paddy/Banana)" }
};

// Plant Disease Diagnostic Local DB
const DISEASE_PRESETS = {
  cotton_curl: {
    name: 'Cotton Leaf Curl Virus (CLCuV)',
    crop: 'Cotton',
    confidence: '96.4%',
    symptoms: 'Upward leaf curling, thickened veins, enation on underside of leaves, stunted floral growth.',
    organic: 'Foliar spray of 5% Neem seed kernel extract (NSKE) + yellow sticky traps for whiteflies vector.',
    chemical: 'Apply Imidacloprid 17.8% SL @ 0.3ml/L or Diafenthiuron 50% WP @ 1g/L to eliminate vector populations.',
    prevention: 'Eradicate alternative weed hosts (Abutilon indicum) near bunds and maintain proper plant spacing.'
  },
  wheat_rust: {
    name: 'Stripe / Yellow Rust (Puccinia striiformis)',
    crop: 'Wheat',
    confidence: '94.8%',
    symptoms: 'Bright yellow-orange pustules arranged in linear stripes along the leaf veins; powdery yellow spore release.',
    organic: 'Trichoderma viride bio-fungicide foliar spray @ 5g/L; avoid excess late nitrogen fertilization.',
    chemical: 'Spray Propiconazole 25% EC (Tilt) @ 1.0ml/L or Tebuconazole 25.9% EC @ 1.25ml/L at first appearance.',
    prevention: 'Use rust-resistant wheat cultivars (e.g., HD-3086, DBW-187) and timely autumn sowing.'
  },
  tomato_blight: {
    name: 'Early Blight (Alternaria solani)',
    crop: 'Tomato',
    confidence: '98.1%',
    symptoms: 'Concentric brown-to-black target ring lesions on older leaves, surrounded by yellow halos; leaf drop.',
    organic: 'Copper oxychloride or Bordeaux mixture (1%) spray combined with Bacillus subtilis bio-agent.',
    chemical: 'Mancozeb 75% WP @ 2.5g/L or Chlorothalonil 75% WP @ 2g/L alternately every 10-12 days.',
    prevention: 'Avoid overhead sprinkler watering; prune lower canopy foliage; apply mulch to block soil splash.'
  },
  rice_blast: {
    name: 'Rice Blast (Magnaporthe oryzae)',
    crop: 'Rice (Paddy)',
    confidence: '95.3%',
    symptoms: 'Spindle-shaped lesions with grayish centers and dark brown margins on leaf blades; neck node rotting.',
    organic: 'Pseudomonas fluorescens seed treatment (10g/kg) and foliar spray (2.5kg/ha).',
    chemical: 'Tricyclazole 75% WP @ 0.6g/L or Isoprothiolane 40% EC @ 1.5ml/L at boot leaf stage.',
    prevention: 'Balanced nitrogen application split into 3 doses; avoid standing cold floodwater.'
  },
  healthy_leaf: {
    name: 'Healthy Foliage — No Pathogen Detected',
    crop: 'Multiple Crops',
    confidence: '99.2%',
    symptoms: 'Vibrant chlorophyll density, uniform vein structure, no active necrotic or chlorotic lesions.',
    organic: 'Maintain routine preventative botanical sprays (Panchagavya or seaweed extract @ 3ml/L).',
    chemical: 'No chemical fungicide required. Maintain soil nutrient balance.',
    prevention: 'Continue standard scouting and preserve beneficial predatory insects.'
  }
};

// =========================================================================
// APPLICATION INITIALIZATION
// =========================================================================
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initNavigation();
  initSliderSync();
  initCommandPalette();
  initApp();
});

async function initApp() {
  await checkAuthStatus();
  await loadDashboardData();
  await loadWeatherData();
  recalculateRoi();
}

// -------------------------------------------------------------------------
// THEME MANAGEMENT (Light / Dark)
// -------------------------------------------------------------------------
function initTheme() {
  const savedTheme = localStorage.getItem('agri_theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const newTheme = current === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('agri_theme', newTheme);
  updateThemeIcon(newTheme);
  
  // Re-render charts with updated theme colors if active
  if (charts.cropProb) renderCropProbChart();
  if (charts.soilRadar) renderSoilRadarChart();
  if (charts.weatherHourly) renderWeatherHourlyChart();
  if (charts.roiCost) recalculateRoi();

  showToast(`Switched to ${newTheme.toUpperCase()} theme`, 'info');
}

function updateThemeIcon(theme) {
  const icon = document.getElementById('themeIcon');
  if (icon) {
    icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
  }
}

// -------------------------------------------------------------------------
// NAVIGATION & SPA ROUTING
// -------------------------------------------------------------------------
function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const targetView = item.getAttribute('data-view');
      if (targetView) switchView(targetView);
    });
  });

  const mobileToggle = document.getElementById('mobileToggle');
  const sidebar = document.querySelector('.sidebar');
  if (mobileToggle && sidebar) {
    mobileToggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
  }

  const collapseBtn = document.getElementById('sidebarCollapseBtn');
  if (collapseBtn && sidebar) {
    collapseBtn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
  }
}

function switchView(viewId) {
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const activeNav = document.querySelector(`.nav-item[data-view="${viewId}"]`);
  if (activeNav) activeNav.classList.add('active');

  document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
  const activeSection = document.getElementById(`view-${viewId}`);
  if (activeSection) activeSection.classList.add('active');

  // Trigger view specific initializers
  if (viewId === 'map') {
    setTimeout(() => {
      initGisMap();
      if (gisMap) gisMap.invalidateSize();
    }, 100);
  }
  if (viewId === 'history') loadHistoryData();
  if (viewId === 'soil-health') renderSoilRadarChart();
  if (viewId === 'weather') renderWeatherHourlyChart();
  if (viewId === 'roi') recalculateRoi();

  const sidebar = document.querySelector('.sidebar');
  if (sidebar) sidebar.classList.remove('open');
}

// -------------------------------------------------------------------------
// MULTI-PLOT MANAGEMENT & GIS MAP
// -------------------------------------------------------------------------
function togglePlotDropdown() {
  const plot = PLOTS_DATA[activePlotId];
  const nextId = activePlotId === 'plot-a' ? 'plot-b' : activePlotId === 'plot-b' ? 'plot-c' : 'plot-a';
  selectPlot(nextId);
}

function selectPlot(plotId) {
  if (!PLOTS_DATA[plotId]) return;
  activePlotId = plotId;
  const plot = PLOTS_DATA[plotId];

  // Update Topbar Label
  const label = document.getElementById('activePlotLabel');
  if (label) label.textContent = `${plot.name} (${plot.crop.split(' ')[0]})`;

  // Update Inspector Card
  const inspName = document.getElementById('inspectorPlotName');
  if (inspName) inspName.textContent = plot.name;
  const inspCrop = document.getElementById('inspectorPlotCrop');
  if (inspCrop) inspCrop.textContent = plot.crop;
  const inspAcres = document.getElementById('inspectorPlotAcres');
  if (inspAcres) inspAcres.textContent = `${plot.acres} Acres`;
  const inspMoisture = document.getElementById('inspectorPlotMoisture');
  if (inspMoisture) inspMoisture.textContent = `${plot.moisture}% (${plot.moisture > 50 ? 'Ideal' : 'Irrigate'})`;
  const inspNdvi = document.getElementById('inspectorPlotNdvi');
  if (inspNdvi) inspNdvi.textContent = `${plot.ndvi} (Vigorous)`;
  const inspValve = document.getElementById('inspectorValveStatus');
  if (inspValve) inspValve.textContent = `Valve Status: ${plot.valve_status}`;
  const inspValveRun = document.getElementById('inspectorValveLastRun');
  if (inspValveRun) inspValveRun.textContent = `Last cycle: ${plot.valve_last_run}`;
  const btnValve = document.getElementById('btnTogglePlotValve');
  if (btnValve) {
    btnValve.innerHTML = plot.valve_status === 'RUNNING' ? '<i class="fas fa-stop"></i> Stop Valve' : '<i class="fas fa-play"></i> Start Valve';
  }

  // Update Dashboard Telemetry values to match active plot
  const dashMoisture = document.getElementById('dashMoisture');
  if (dashMoisture) dashMoisture.textContent = `${plot.moisture}.0%`;
  const dashN = document.getElementById('dash-val-n');
  if (dashN) dashN.textContent = `${plot.n}.0 mg/kg`;
  const dashP = document.getElementById('dash-val-p');
  if (dashP) dashP.textContent = `${plot.p}.0 mg/kg`;
  const dashK = document.getElementById('dash-val-k');
  if (dashK) dashK.textContent = `${plot.k}.0 mg/kg`;
  const dashPh = document.getElementById('dash-val-ph');
  if (dashPh) dashPh.textContent = `${plot.ph} (${plot.ph > 7.0 ? 'Slightly Alkaline' : 'Neutral'})`;

  // Sync with GIS Map
  if (gisMap) {
    gisMap.setView(plot.coords, 16);
  }

  showToast(`Switched active field to ${plot.name}`, 'info');
}

function initGisMap() {
  if (gisMap) return;
  const mapContainer = document.getElementById('farmGisMap');
  if (!mapContainer) return;

  const defaultPlot = PLOTS_DATA[activePlotId];
  gisMap = L.map('farmGisMap', {
    center: defaultPlot.coords,
    zoom: 16,
    zoomControl: true
  });

  // Base Map Tile Layers
  mapLayers.satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Esri Satellite Imagery'
  }).addTo(gisMap);

  mapLayers.streets = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap'
  });

  mapLayers.topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    attribution: 'OpenTopoMap'
  });

  // Plot Parcel Polygons
  mapLayers.polygons = L.layerGroup().addTo(gisMap);
  mapLayers.sensors = L.layerGroup().addTo(gisMap);

  Object.values(PLOTS_DATA).forEach(plot => {
    // NDVI colored polygon
    const color = plot.ndvi > 0.7 ? '#10b981' : plot.ndvi > 0.5 ? '#f59e0b' : '#ef4444';
    const polygon = L.polygon(plot.polygon, {
      color: color,
      fillColor: color,
      fillOpacity: 0.35,
      weight: 3
    }).addTo(mapLayers.polygons);

    polygon.bindPopup(`
      <div style="font-family: var(--font-main); padding: 4px;">
        <h4 style="margin: 0 0 4px 0; color: #0f172a; font-size: 14px;"><strong>${plot.name}</strong></h4>
        <div style="font-size: 12px; color: #475569; line-height: 1.5;">
          <strong>Crop:</strong> ${plot.crop}<br>
          <strong>Area:</strong> ${plot.acres} Acres<br>
          <strong>Moisture:</strong> ${plot.moisture}%<br>
          <strong>NDVI Index:</strong> ${plot.ndvi}
        </div>
        <button onclick="selectPlot('${plot.id}')" style="margin-top: 8px; width: 100%; padding: 4px 8px; background: #059669; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: bold;">
          Inspect Plot
        </button>
      </div>
    `);

    polygon.on('click', () => selectPlot(plot.id));

    // IoT Sensor Marker
    const marker = L.circleMarker(plot.coords, {
      radius: 8,
      fillColor: '#0284c7',
      color: '#ffffff',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.9
    }).addTo(mapLayers.sensors);

    marker.bindPopup(`<strong>📡 IoT Probe Node — ${plot.name}</strong><br>Telemetry: NPK, Moisture, Soil Temp`);
  });
}

function setMapBaseLayer(layerName) {
  if (!gisMap) return;
  ['satellite', 'streets', 'topo'].forEach(name => {
    if (mapLayers[name] && gisMap.hasLayer(mapLayers[name])) {
      gisMap.removeLayer(mapLayers[name]);
    }
    const btn = document.getElementById(`layerBtn${name.charAt(0).toUpperCase() + name.slice(1)}`);
    if (btn) btn.classList.remove('active');
  });

  if (mapLayers[layerName]) {
    gisMap.addLayer(mapLayers[layerName]);
    const activeBtn = document.getElementById(`layerBtn${layerName.charAt(0).toUpperCase() + layerName.slice(1)}`);
    if (activeBtn) activeBtn.classList.add('active');
  }
}

function toggleNdviLayer() {
  if (!gisMap || !mapLayers.polygons) return;
  const btn = document.getElementById('layerToggleNdvi');
  if (gisMap.hasLayer(mapLayers.polygons)) {
    gisMap.removeLayer(mapLayers.polygons);
    if (btn) btn.classList.remove('active');
  } else {
    gisMap.addLayer(mapLayers.polygons);
    if (btn) btn.classList.add('active');
  }
}

function toggleSensorMarkers() {
  if (!gisMap || !mapLayers.sensors) return;
  const btn = document.getElementById('layerToggleSensors');
  if (gisMap.hasLayer(mapLayers.sensors)) {
    gisMap.removeLayer(mapLayers.sensors);
    if (btn) btn.classList.remove('active');
  } else {
    gisMap.addLayer(mapLayers.sensors);
    if (btn) btn.classList.add('active');
  }
}

function recenterMap() {
  if (gisMap && PLOTS_DATA[activePlotId]) {
    gisMap.setView(PLOTS_DATA[activePlotId].coords, 16);
  }
}

async function toggleActivePlotValve() {
  const plot = PLOTS_DATA[activePlotId];
  if (!plot) return;

  const nextState = plot.valve_status === 'RUNNING' ? 'IDLE' : 'RUNNING';
  plot.valve_status = nextState;
  plot.valve_last_run = nextState === 'RUNNING' ? 'Running (Active 30m)' : 'Stopped manually just now';

  selectPlot(activePlotId);
  showToast(`${plot.name} valve is now ${nextState}`, nextState === 'RUNNING' ? 'success' : 'info');

  // Sync to API
  try {
    await fetch(`${API_BASE}/api/plots/${activePlotId}/valve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle' })
    });
  } catch (e) {
    console.log('Valve API simulated response.');
  }
}

// -------------------------------------------------------------------------
// SLIDER & INPUT SYNCHRONIZATION
// -------------------------------------------------------------------------
function initSliderSync() {
  const sliders = [
    { slider: 'slider-n', badge: 'badge-n' },
    { slider: 'slider-p', badge: 'badge-p' },
    { slider: 'slider-k', badge: 'badge-k' },
    { slider: 'slider-ph', badge: 'badge-ph' },
    { slider: 'slider-moisture', badge: 'badge-moisture' }
  ];

  sliders.forEach(s => {
    const sliderEl = document.getElementById(s.slider);
    const badgeEl = document.getElementById(s.badge);

    if (sliderEl && badgeEl) {
      sliderEl.addEventListener('input', (e) => {
        badgeEl.textContent = e.target.value;
      });
    }
  });
}

function applySoilPreset(presetKey) {
  const p = SOIL_PRESETS[presetKey];
  if (!p) return;

  const setVal = (id, val) => {
    const s = document.getElementById(`slider-${id}`);
    const b = document.getElementById(`badge-${id}`);
    if (s) s.value = val;
    if (b) b.textContent = val;
  };

  setVal('n', p.n);
  setVal('p', p.p);
  setVal('k', p.k);
  setVal('ph', p.ph);
  setVal('moisture', p.moisture);

  showToast(`Applied preset: ${p.name}`, 'info');
}

function syncWeatherToCropForm() {
  if (!liveWeatherData) return;
  const tempInput = document.getElementById('input-rec-temp');
  const humInput = document.getElementById('input-rec-hum');
  const rainInput = document.getElementById('input-rec-rain');

  if (tempInput) tempInput.value = liveWeatherData.temperature;
  if (humInput) humInput.value = liveWeatherData.humidity;
  if (rainInput) rainInput.value = liveWeatherData.annual_rainfall || 750;

  showToast('Synced live weather variables to recommendation engine', 'success');
}

// -------------------------------------------------------------------------
// CROP RECOMMENDATION ML INFERENCE
// -------------------------------------------------------------------------
async function handleCropRecommendation(event) {
  event.preventDefault();
  const btn = document.getElementById('btnRunCropRec');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Running ML Inference...';
  }

  const payload = {
    nitrogen: parseFloat(document.getElementById('slider-n').value),
    phosphorus: parseFloat(document.getElementById('slider-p').value),
    potassium: parseFloat(document.getElementById('slider-k').value),
    ph: parseFloat(document.getElementById('slider-ph').value),
    moisture: parseFloat(document.getElementById('slider-moisture').value),
    temperature: parseFloat(document.getElementById('input-rec-temp').value),
    humidity: parseFloat(document.getElementById('input-rec-hum').value),
    rainfall: parseFloat(document.getElementById('input-rec-rain').value)
  };

  try {
    const res = await fetch(`${API_BASE}/api/recommend-crop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error('ML recommendation request failed');
    const data = await res.json();
    renderCropRecommendations(data);
    showToast('Precision crop recommendation complete!', 'success');
  } catch (err) {
    console.error(err);
    // Fallback simulated ML data
    renderCropRecommendations({
      all_recommendations: [
        { crop_name: 'Cotton', confidence_score: 94.2, yield_potential: '1.2 - 1.5 T/Ac', water_req: 'Medium', profit_index: 'High ($7,200/T)' },
        { crop_name: 'Wheat', confidence_score: 82.5, yield_potential: '2.0 - 2.4 T/Ac', water_req: 'Moderate', profit_index: 'Stable ($2,275/Q)' },
        { crop_name: 'Maize (Corn)', confidence_score: 71.0, yield_potential: '3.0 - 3.5 T/Ac', water_req: 'Medium', profit_index: 'Moderate ($2,090/Q)' },
        { crop_name: 'Chickpea', confidence_score: 58.4, yield_potential: '0.8 - 1.1 T/Ac', water_req: 'Low', profit_index: 'High ($5,440/Q)' }
      ]
    });
    showToast('Generated simulated precision recommendations', 'info');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-microchip"></i> Predict Best Crops (ML Engine)';
    }
  }
}

function renderCropRecommendations(data) {
  const container = document.getElementById('cropResultsContainer');
  if (!container) return;

  const crops = data.all_recommendations || [];
  if (!crops.length) {
    container.innerHTML = `<p style="text-align: center; color: var(--text-muted); padding: 20px;">No matching crops found for current parameters.</p>`;
    return;
  }

  const cropEmojis = {
    'Cotton': '🌱', 'Wheat': '🌾', 'Rice': '🍚', 'Maize': '🌽', 'Chickpea': '🫘',
    'Tomato': '🍅', 'Sugarcane': '🎋', 'Jute': '🌿', 'Banana': '🍌', 'Coffee': '☕'
  };

  let html = `<div class="crop-rec-grid">`;
  crops.forEach((c, idx) => {
    const isTop = idx === 0;
    const emoji = cropEmojis[c.crop_name.split(' ')[0]] || '🌱';
    html += `
      <div class="crop-card-pro ${isTop ? 'featured' : ''}">
        ${isTop ? '<span class="badge green" style="position: absolute; top: 12px; right: 12px;"><i class="fas fa-crown"></i> Prime Match</span>' : ''}
        <div class="crop-card-header">
          <div class="crop-meta-top">
            <span class="crop-icon-lg">${emoji}</span>
            <div>
              <div class="crop-title-text">${c.crop_name}</div>
              <div style="font-size: 0.76rem; color: var(--text-secondary);">Rank #${idx + 1} Candidate</div>
            </div>
          </div>
          <div class="crop-score-pro" style="${isTop ? '' : 'font-size: 1.25rem; color: var(--text-secondary);'}">${c.confidence_score}%</div>
        </div>

        <div class="crop-metrics-list">
          <div class="crop-metrics-item">Yield Potential: <strong>${c.yield_potential || '1.2 - 1.8 T/Ac'}</strong></div>
          <div class="crop-metrics-item">Water Demand: <strong>${c.water_req || 'Moderate'}</strong></div>
          <div class="crop-metrics-item">Economic Return: <strong>${c.profit_index || 'High'}</strong></div>
          <div class="crop-metrics-item">Sowing Window: <strong>June - July</strong></div>
        </div>
      </div>
    `;
  });
  html += `</div>`;
  container.innerHTML = html;

  renderCropProbChart(crops);
}

function renderCropProbChart(cropsData) {
  const canvas = document.getElementById('cropProbCanvas');
  if (!canvas) return;

  const crops = cropsData || [
    { crop_name: 'Cotton', confidence_score: 94.2 },
    { crop_name: 'Wheat', confidence_score: 82.5 },
    { crop_name: 'Maize', confidence_score: 71.0 },
    { crop_name: 'Chickpea', confidence_score: 58.4 }
  ];

  if (charts.cropProb) charts.cropProb.destroy();

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const textColor = isDark ? '#94a3b8' : '#475569';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

  charts.cropProb = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: crops.map(c => c.crop_name),
      datasets: [{
        label: 'Model Confidence (%)',
        data: crops.map(c => c.confidence_score),
        backgroundColor: crops.map((_, i) => i === 0 ? '#059669' : '#0284c7'),
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, max: 100, grid: { color: gridColor }, ticks: { color: textColor } },
        x: { grid: { display: false }, ticks: { color: textColor } }
      }
    }
  });
}

// -------------------------------------------------------------------------
// SOIL HEALTH & DIAGNOSTICS
// -------------------------------------------------------------------------
async function handleSoilSave(event) {
  event.preventDefault();
  const payload = {
    ph: parseFloat(document.getElementById('soilFormPh').value),
    nitrogen: parseFloat(document.getElementById('soilFormN').value),
    phosphorus: parseFloat(document.getElementById('soilFormP').value),
    potassium: parseFloat(document.getElementById('soilFormK').value),
    moisture: parseFloat(document.getElementById('soilFormMoisture').value),
    organic_matter: parseFloat(document.getElementById('soilFormOrg').value),
    notes: document.getElementById('soilFormNotes').value
  };

  try {
    const res = await fetch(`${API_BASE}/api/soil`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to save soil log');
    const data = await res.json();
    
    // Update Scorecard
    const score = data.health_report ? data.health_report.score : 88;
    const scoreEl = document.getElementById('soilHealthScoreDisplay');
    if (scoreEl) scoreEl.textContent = `${score} / 100`;

    document.getElementById('labPh').textContent = payload.ph;
    document.getElementById('labN').innerHTML = `${payload.nitrogen} <small style="font-size:0.65rem">mg/kg</small>`;
    document.getElementById('labP').innerHTML = `${payload.phosphorus} <small style="font-size:0.65rem">mg/kg</small>`;
    document.getElementById('labK').innerHTML = `${payload.potassium} <small style="font-size:0.65rem">mg/kg</small>`;

    renderSoilRadarChart(payload);
    showToast('Soil diagnostic sample recorded and benchmarked!', 'success');
  } catch (err) {
    showToast('Saved soil test sample locally', 'info');
    renderSoilRadarChart(payload);
  }
}

function renderSoilRadarChart(soilData) {
  const canvas = document.getElementById('soilRadarCanvas');
  if (!canvas) return;

  const cur = soilData || { ph: 6.8, nitrogen: 85, phosphorus: 48, potassium: 52, moisture: 58 };

  if (charts.soilRadar) charts.soilRadar.destroy();

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const textColor = isDark ? '#94a3b8' : '#475569';
  const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';

  charts.soilRadar = new Chart(canvas.getContext('2d'), {
    type: 'radar',
    data: {
      labels: ['Nitrogen (N)', 'Phosphorus (P)', 'Potassium (K)', 'pH Balance', 'Moisture Content', 'Organic Carbon'],
      datasets: [
        {
          label: 'Current Soil Sample',
          data: [cur.nitrogen || 85, cur.phosphorus || 48, cur.potassium || 52, (cur.ph || 6.8) * 12, cur.moisture || 58, 65],
          backgroundColor: 'rgba(5, 150, 105, 0.25)',
          borderColor: '#059669',
          borderWidth: 2,
          pointBackgroundColor: '#059669'
        },
        {
          label: 'Optimal Benchmark Range',
          data: [90, 50, 60, 80, 60, 75],
          backgroundColor: 'rgba(2, 132, 199, 0.12)',
          borderColor: '#0284c7',
          borderWidth: 1.5,
          borderDash: [4, 4],
          pointBackgroundColor: '#0284c7'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          grid: { color: gridColor },
          angleLines: { color: gridColor },
          pointLabels: { color: textColor, font: { size: 11, weight: 'bold' } },
          ticks: { display: false }
        }
      },
      plugins: {
        legend: {
          labels: { color: textColor, font: { size: 11 } }
        }
      }
    }
  });
}

// -------------------------------------------------------------------------
// SMART IRRIGATION CONTROLLER
// -------------------------------------------------------------------------
async function handleIrrigationPlanner(event) {
  event.preventDefault();
  const crop = document.getElementById('irrCropSelect').value;
  const soil = document.getElementById('irrSoilTypeSelect').value;
  const moisture = parseFloat(document.getElementById('irrMoistureInput').value);
  const acres = parseFloat(document.getElementById('irrAcreageInput').value);

  try {
    const res = await fetch(`${API_BASE}/api/irrigation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ crop_name: crop, soil_type: soil, moisture: moisture, farm_size_acres: acres })
    });
    const data = await res.json();
    
    document.getElementById('irrSummaryText').textContent = data.action_summary;
    document.getElementById('irrPumpRuntime').textContent = `${data.pump_runtime_hours} hrs`;
    document.getElementById('irrWaterVol').textContent = `${data.water_volume_liters.toLocaleString()} L`;
    document.getElementById('irrBestWindow').textContent = data.optimal_time_window;
    
    const badge = document.getElementById('irrStatusBadge');
    if (badge) {
      badge.className = `badge ${data.urgency === 'High' ? 'red' : data.urgency === 'Medium' ? 'amber' : 'green'}`;
      badge.textContent = `${data.urgency} Priority`;
    }
    showToast('Irrigation watering schedule recalculated', 'success');
  } catch (err) {
    showToast('Irrigation schedule updated locally', 'info');
  }
}

// -------------------------------------------------------------------------
// WEATHER AGRO-STATION
// -------------------------------------------------------------------------
async function loadWeatherData(city) {
  try {
    const url = city ? `${API_BASE}/api/weather?city=${encodeURIComponent(city)}` : `${API_BASE}/api/weather`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Weather API error');
    const data = await res.json();
    liveWeatherData = data;

    // Header Pill
    const hTemp = document.getElementById('headerWeatherTemp');
    if (hTemp) hTemp.textContent = `${data.temperature}°C`;
    const hDesc = document.getElementById('headerWeatherDesc');
    if (hDesc) hDesc.textContent = data.condition_text;

    // Dashboard Climate Card
    const dLoc = document.getElementById('dashWeatherLoc');
    if (dLoc) dLoc.textContent = data.location_name;
    const dTemp = document.getElementById('dashWeatherTemp');
    if (dTemp) dTemp.textContent = `${data.temperature}°C`;
    const dCond = document.getElementById('dashWeatherCondition');
    if (dCond) dCond.textContent = `${data.condition_text} ⛅`;
    const dHum = document.getElementById('dashWeatherHumidity');
    if (dHum) dHum.textContent = `${data.humidity}%`;
    const dWind = document.getElementById('dashWeatherWind');
    if (dWind) dWind.textContent = `${data.wind_speed} km/h`;
    const dRain = document.getElementById('dashWeatherRainRisk');
    if (dRain) dRain.textContent = `${data.rain_24h_mm || 0.0} mm (${data.precipitation_prob_today || 0}%)`;

    // Spraying Window Logic
    const sprayBadge = document.getElementById('dashSprayingBadge');
    if (sprayBadge) {
      if (data.wind_speed < 15 && data.humidity > 45 && data.humidity < 80) {
        sprayBadge.className = 'badge green';
        sprayBadge.innerHTML = '<i class="fas fa-spray-can"></i> Spray Window: Optimal';
      } else {
        sprayBadge.className = 'badge amber';
        sprayBadge.innerHTML = '<i class="fas fa-triangle-exclamation"></i> Spray Window: Caution (High Wind)';
      }
    }

    // Render Extended 7-Day Forecast
    renderExtendedWeather(data.daily_forecast || []);
    renderWeatherHourlyChart(data.hourly_forecast || []);

  } catch (e) {
    console.warn('Weather load simulated fallback', e);
  }
}

function renderExtendedWeather(forecast) {
  const container = document.getElementById('weatherExtendedGrid');
  const dashRow = document.getElementById('dashForecastRow');
  
  const sampleForecast = forecast.length ? forecast : [
    { day: 'Today', max: 31, min: 22, rain: 5, icon: '☀️' },
    { day: 'Tomorrow', max: 29, min: 21, rain: 15, icon: '⛅' },
    { day: 'Wednesday', max: 28, min: 20, rain: 40, icon: '🌦️' },
    { day: 'Thursday', max: 27, min: 19, rain: 65, icon: '🌧️' },
    { day: 'Friday', max: 30, min: 21, rain: 10, icon: '🌤️' },
    { day: 'Saturday', max: 32, min: 22, rain: 0, icon: '☀️' },
    { day: 'Sunday', max: 33, min: 23, rain: 0, icon: '☀️' }
  ];

  if (container) {
    container.innerHTML = sampleForecast.map(f => `
      <div style="background: var(--bg-card-subtle); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 14px; text-align: center;">
        <div style="font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px;">${f.day}</div>
        <div style="font-size: 26px; margin: 4px 0;">${f.icon}</div>
        <div style="font-size: 0.95rem; font-weight: 800; font-family: var(--font-mono);">${f.max}° / <span style="color: var(--text-muted); font-size: 0.8rem;">${f.min}°</span></div>
        <div style="font-size: 0.72rem; color: var(--accent-cyan); margin-top: 4px;"><i class="fas fa-droplet"></i> ${f.rain}%</div>
      </div>
    `).join('');
  }

  if (dashRow) {
    dashRow.innerHTML = sampleForecast.slice(0, 5).map(f => `
      <div style="background: var(--bg-card-subtle); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 10px; text-align: center;">
        <div style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted);">${f.day}</div>
        <div style="font-size: 20px; margin: 2px 0;">${f.icon}</div>
        <div style="font-size: 0.82rem; font-weight: 800; font-family: var(--font-mono);">${f.max}° <small style="color:var(--text-muted)">${f.min}°</small></div>
      </div>
    `).join('');
  }
}

function renderWeatherHourlyChart(hourly) {
  const canvas = document.getElementById('weatherHourlyCanvas');
  if (!canvas) return;

  if (charts.weatherHourly) charts.weatherHourly.destroy();

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const textColor = isDark ? '#94a3b8' : '#475569';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

  const labels = ['06:00', '09:00', '12:00', '15:00', '18:00', '21:00', '00:00', '03:00'];
  const temps = [22, 26, 31, 32, 29, 25, 23, 21];
  const rain = [0, 5, 10, 15, 30, 20, 10, 5];

  charts.weatherHourly = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Temperature (°C)',
          data: temps,
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          fill: true,
          tension: 0.35,
          yAxisID: 'y'
        },
        {
          label: 'Rain Probability (%)',
          data: rain,
          type: 'bar',
          backgroundColor: 'rgba(2, 132, 199, 0.4)',
          borderRadius: 4,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        y: { type: 'linear', position: 'left', grid: { color: gridColor }, ticks: { color: textColor } },
        y1: { type: 'linear', position: 'right', min: 0, max: 100, grid: { display: false }, ticks: { color: textColor } },
        x: { grid: { color: gridColor }, ticks: { color: textColor } }
      },
      plugins: {
        legend: { labels: { color: textColor } }
      }
    }
  });
}

// -------------------------------------------------------------------------
// PLANT DISEASE SCANNER
// -------------------------------------------------------------------------
function scanDiseaseSample(sampleKey, elem) {
  document.querySelectorAll('.sample-preset-card').forEach(c => c.classList.remove('active'));
  if (elem) elem.classList.add('active');

  const info = DISEASE_PRESETS[sampleKey];
  if (!info) return;

  const nameEl = document.getElementById('diseaseName');
  if (nameEl) nameEl.textContent = info.name;
  const cropEl = document.getElementById('diseaseCrop');
  if (cropEl) cropEl.textContent = `Crop: ${info.crop}`;
  const confEl = document.getElementById('diseaseConfidence');
  if (confEl) confEl.textContent = info.confidence;
  const sympEl = document.getElementById('diseaseSymptoms');
  if (sympEl) sympEl.textContent = info.symptoms;
  const orgEl = document.getElementById('diseaseOrganic');
  if (orgEl) orgEl.textContent = info.organic;
  const chemEl = document.getElementById('diseaseChemical');
  if (chemEl) chemEl.textContent = info.chemical;
  const prevEl = document.getElementById('diseasePrevention');
  if (prevEl) prevEl.innerHTML = `<strong>Prevention:</strong> ${info.prevention}`;

  showToast(`Scanned sample: ${info.name}`, 'success');
}

function simulateImageUpload() {
  const samples = Object.keys(DISEASE_PRESETS);
  const randomSample = samples[Math.floor(Math.random() * samples.length)];
  showToast('Analyzing uploaded leaf image with AI Vision...', 'info');
  setTimeout(() => {
    scanDiseaseSample(randomSample);
  }, 600);
}

// -------------------------------------------------------------------------
// YIELD & ROI ECONOMIC CALCULATOR
// -------------------------------------------------------------------------
function recalculateRoi() {
  const crop = document.getElementById('roiCrop') ? document.getElementById('roiCrop').value : 'Cotton';
  const acres = parseFloat(document.getElementById('roiAcres')?.value || 5.0);
  const yieldPerAcre = parseFloat(document.getElementById('roiYieldPerAcre')?.value || 1.2);
  const price = parseFloat(document.getElementById('roiPrice')?.value || 7200);

  const seedCost = parseFloat(document.getElementById('roiSeedCost')?.value || 2200);
  const fertCost = parseFloat(document.getElementById('roiFertCost')?.value || 4500);
  const irrCost = parseFloat(document.getElementById('roiIrrCost')?.value || 1800);
  const laborCost = parseFloat(document.getElementById('roiLaborCost')?.value || 6500);

  const totalYield = acres * yieldPerAcre;
  const grossRev = totalYield * price;
  const costPerAcre = seedCost + fertCost + irrCost + laborCost;
  const totalCost = costPerAcre * acres;
  const netProfit = grossRev - totalCost;
  const roiPct = totalCost > 0 ? ((netProfit / totalCost) * 100).toFixed(1) : 0;

  const netEl = document.getElementById('roiNetProfit');
  if (netEl) netEl.textContent = `$${Math.round(netProfit).toLocaleString()}`;
  const grossEl = document.getElementById('roiGrossRev');
  if (grossEl) grossEl.textContent = `$${Math.round(grossRev).toLocaleString()}`;
  const costEl = document.getElementById('roiTotalCost');
  if (costEl) costEl.textContent = `$${Math.round(totalCost).toLocaleString()}`;
  const roiPctEl = document.getElementById('roiPctDisplay');
  if (roiPctEl) roiPctEl.textContent = `${roiPct}%`;

  renderRoiCostDonut([seedCost * acres, fertCost * acres, irrCost * acres, laborCost * acres]);
}

function renderRoiCostDonut(costs) {
  const canvas = document.getElementById('roiCostDonutCanvas');
  if (!canvas) return;

  if (charts.roiCost) charts.roiCost.destroy();

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const textColor = isDark ? '#94a3b8' : '#475569';

  charts.roiCost = new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: ['Seeds', 'Fertilizer', 'Irrigation', 'Labor & Machinery'],
      datasets: [{
        data: costs || [11000, 22500, 9000, 32500],
        backgroundColor: ['#10b981', '#0284c7', '#f59e0b', '#7c3aed'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { color: textColor, font: { size: 10 } } }
      }
    }
  });
}

// -------------------------------------------------------------------------
// AGROBOT AI CONVERSATION ASSISTANT
// -------------------------------------------------------------------------
function toggleAgroBotDrawer() {
  const drawer = document.getElementById('agrobotDrawer');
  if (drawer) drawer.classList.toggle('open');
}

async function sendAgrobotMessage() {
  const input = document.getElementById('agrobotInput');
  if (!input || !input.value.trim()) return;

  const text = input.value.trim();
  input.value = '';

  appendAgrobotBubble(text, 'user');

  try {
    const res = await fetch(`${API_BASE}/api/agrobot/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text })
    });
    const data = await res.json();
    appendAgrobotBubble(data.reply || 'I am processing your query...', 'bot');
  } catch (err) {
    appendAgrobotBubble(`🌱 **Agronomy Tip:** In precision management for ${text}, monitor root-zone moisture at 55-65% and calibrate NPK split applications to avoid leaf burn.`, 'bot');
  }
}

function sendAgrobotPrompt(promptText) {
  const input = document.getElementById('agrobotInput');
  if (input) input.value = promptText;
  sendAgrobotMessage();
}

function appendAgrobotBubble(content, sender) {
  const body = document.getElementById('agrobotChatBody');
  if (!body) return;

  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${sender}`;
  bubble.innerHTML = content.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  body.appendChild(bubble);
  body.scrollTop = body.scrollHeight;
}

// -------------------------------------------------------------------------
// COMMAND PALETTE (Cmd+K / Ctrl+K)
// -------------------------------------------------------------------------
const COMMANDS = [
  { name: 'Dashboard Overview', icon: 'fas fa-grid-2', view: 'dashboard' },
  { name: 'Field GIS & Satellite Map', icon: 'fas fa-map-location-dot', view: 'map' },
  { name: 'Crop Recommendation ML', icon: 'fas fa-seedling', view: 'crop-rec' },
  { name: 'Soil Health & Lab Test', icon: 'fas fa-flask-vial', view: 'soil-health' },
  { name: 'Smart Irrigation & IoT', icon: 'fas fa-faucet-drip', view: 'irrigation' },
  { name: 'Weather Agro-Station', icon: 'fas fa-cloud-sun-rain', view: 'weather' },
  { name: 'Plant Disease AI Scanner', icon: 'fas fa-shield-virus', view: 'disease' },
  { name: 'Yield & ROI Calculator', icon: 'fas fa-calculator', view: 'roi' },
  { name: 'Audit History & Reports', icon: 'fas fa-file-lines', view: 'history' },
  { name: 'Farmer Profile Settings', icon: 'fas fa-user-gear', view: 'profile' }
];

function initCommandPalette() {
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openCommandPalette();
    }
    if (e.key === 'Escape') {
      closeModal('commandModal');
    }
  });
}

function openCommandPalette() {
  openModal('commandModal');
  filterCommandPalette('');
  setTimeout(() => {
    document.getElementById('commandInput')?.focus();
  }, 50);
}

function filterCommandPalette(query) {
  const resultsContainer = document.getElementById('commandResults');
  if (!resultsContainer) return;

  const q = query.toLowerCase().trim();
  const matched = COMMANDS.filter(c => c.name.toLowerCase().includes(q));

  resultsContainer.innerHTML = matched.map(c => `
    <div onclick="switchView('${c.view}'); closeModal('commandModal');" style="display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-radius: var(--radius-md); cursor: pointer; transition: background 0.15s;" onmouseover="this.style.background='var(--bg-card-subtle)'" onmouseout="this.style.background='transparent'">
      <i class="${c.icon}" style="color: var(--primary); width: 20px; text-align: center;"></i>
      <span style="font-weight: 600; font-size: 0.9rem; color: var(--text-primary);">${c.name}</span>
    </div>
  `).join('');
}

// -------------------------------------------------------------------------
// AUDIT HISTORY & REPORTING
// -------------------------------------------------------------------------
async function loadHistoryData() {
  try {
    const res = await fetch(`${API_BASE}/api/history`);
    const data = await res.json();
    
    // Soil History Table
    const soilTbody = document.getElementById('soilHistoryTbody');
    if (soilTbody) {
      const records = data.soil_history || [];
      if (!records.length) {
        soilTbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 20px;">No historical soil tests recorded yet.</td></tr>`;
      } else {
        soilTbody.innerHTML = records.map(s => `
          <tr>
            <td>${s.test_date ? s.test_date.split('T')[0] : 'Today'}</td>
            <td><strong>${s.ph}</strong></td>
            <td>${s.nitrogen} mg/kg</td>
            <td>${s.phosphorus} mg/kg</td>
            <td>${s.potassium} mg/kg</td>
            <td>${s.moisture}%</td>
            <td><small>${s.notes || 'Routine check'}</small></td>
            <td><button class="btn btn-secondary" style="padding: 4px 8px; font-size: 0.74rem;" onclick="showToast('Sample audit verified', 'info')"><i class="fas fa-eye"></i></button></td>
          </tr>
        `).join('');
      }
    }

    // Recommendation History Table
    const recTbody = document.getElementById('recHistoryTbody');
    if (recTbody) {
      const recs = data.recommendation_history || [];
      if (!recs.length) {
        recTbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 20px;">No recommendations logged yet.</td></tr>`;
      } else {
        recTbody.innerHTML = recs.map(r => `
          <tr>
            <td>${r.date ? r.date.split('T')[0] : 'Recent'}</td>
            <td><strong>🌱 ${r.crop}</strong></td>
            <td><span class="badge green">${r.confidence_score}%</span></td>
            <td>${r.soil_health_score}/100</td>
            <td><small>${r.irrigation || 'Optimal schedule'}</small></td>
            <td><button class="btn btn-secondary" style="padding: 4px 8px; font-size: 0.74rem;" onclick="showToast('Recommendation details loaded', 'info')"><i class="fas fa-file-lines"></i></button></td>
          </tr>
        `).join('');
      }
    }

    renderSoilTrendChart();
  } catch (e) {
    console.warn('History fallback', e);
  }
}

function renderSoilTrendChart() {
  const canvas = document.getElementById('soilTrendCanvas');
  if (!canvas) return;

  if (charts.soilTrend) charts.soilTrend.destroy();

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const textColor = isDark ? '#94a3b8' : '#475569';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

  charts.soilTrend = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'],
      datasets: [
        {
          label: 'Soil Moisture (%)',
          data: [45, 52, 68, 62, 55, 58],
          borderColor: '#0284c7',
          backgroundColor: 'rgba(2, 132, 199, 0.1)',
          tension: 0.3
        },
        {
          label: 'Soil pH (x10)',
          data: [64, 65, 68, 67, 69, 68],
          borderColor: '#059669',
          borderDash: [4, 4],
          tension: 0.3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { grid: { color: gridColor }, ticks: { color: textColor } },
        x: { grid: { color: gridColor }, ticks: { color: textColor } }
      },
      plugins: {
        legend: { labels: { color: textColor } }
      }
    }
  });
}

function exportHistoryCSV() {
  const csvContent = "data:text/csv;charset=utf-8," 
    + "Date,Crop,Confidence,SoilScore,Moisture,pH,Nitrogen\n"
    + "2026-10-01,Cotton (Bt-II),94.2%,88,58.0%,6.8,85.0\n"
    + "2026-09-15,Wheat (Sharbati),82.5%,84,42.0%,7.1,65.0\n"
    + "2026-08-28,Hydroponic Tomato,96.0%,92,72.0%,6.4,110.0\n";

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `agropulse_farm_audit_report_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast('Exported farm records to CSV file', 'success');
}

function exportPrintableReport() {
  showToast('Preparing executive print layout...', 'info');
  setTimeout(() => {
    window.print();
  }, 400);
}

// -------------------------------------------------------------------------
// FARMER AUTH & PROFILE
// -------------------------------------------------------------------------
async function checkAuthStatus() {
  try {
    const res = await fetch(`${API_BASE}/api/auth/me`);
    const data = await res.json();
    if (data.authenticated && data.farmer) {
      currentFarmer = data.farmer;
      updateFarmerUI(data.farmer);
    }
  } catch (e) {
    console.warn('Auth check fallback');
  }
}

function updateFarmerUI(f) {
  if (!f) return;
  const sName = document.getElementById('sidebarFarmerName');
  if (sName) sName.textContent = f.name;
  const sLoc = document.getElementById('sidebarFarmerLoc');
  if (sLoc) sLoc.textContent = `${f.location} • ${f.farm_size_acres} Ac`;
  const dName = document.getElementById('farmerNameDisplay');
  if (dName) dName.textContent = f.name;
  const dLoc = document.getElementById('farmerLocationDisplay');
  if (dLoc) dLoc.textContent = f.location;
  const sAvatar = document.getElementById('sidebarAvatarIcon');
  if (sAvatar) {
    const initials = f.name.split(' ').map(n => n[0]).join('').toUpperCase();
    sAvatar.textContent = initials || 'RP';
  }

  // Profile Form Pre-fill
  const pName = document.getElementById('profName');
  if (pName) pName.value = f.name;
  const pEmail = document.getElementById('profEmail');
  if (pEmail) pEmail.value = f.email;
  const pPhone = document.getElementById('profPhone');
  if (pPhone) pPhone.value = f.phone || '';
  const pLoc = document.getElementById('profLocation');
  if (pLoc) pLoc.value = f.location;
  const pAcres = document.getElementById('profAcreage');
  if (pAcres) pAcres.value = f.farm_size_acres;
  const pCrop = document.getElementById('profPrimaryCrop');
  if (pCrop) pCrop.value = f.primary_crop || 'Cotton';
}

async function handleProfileSave(event) {
  event.preventDefault();
  const payload = {
    name: document.getElementById('profName').value,
    phone: document.getElementById('profPhone').value,
    location: document.getElementById('profLocation').value,
    farm_size_acres: parseFloat(document.getElementById('profAcreage').value),
    soil_type: document.getElementById('profSoilType').value,
    primary_crop: document.getElementById('profPrimaryCrop').value
  };

  try {
    const res = await fetch(`${API_BASE}/api/auth/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.farmer) updateFarmerUI(data.farmer);
    showToast('Farmer profile & farm parameters saved!', 'success');
  } catch (err) {
    updateFarmerUI(payload);
    showToast('Profile updated locally', 'info');
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;

  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (res.ok && data.farmer) {
      updateFarmerUI(data.farmer);
      closeModal('authModal');
      showToast(`Welcome back, ${data.farmer.name}!`, 'success');
    } else {
      showToast(data.error || 'Login failed', 'error');
    }
  } catch (err) {
    closeModal('authModal');
    showToast('Demo login active', 'success');
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const payload = {
    name: document.getElementById('regName').value,
    email: document.getElementById('regEmail').value,
    password: document.getElementById('regPassword').value,
    phone: document.getElementById('regPhone').value,
    location: document.getElementById('regLocation').value
  };

  try {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (res.ok && data.farmer) {
      updateFarmerUI(data.farmer);
      closeModal('authModal');
      showToast('Registration successful! Welcome to AgroPulse AI.', 'success');
    } else {
      showToast(data.error || 'Registration failed', 'error');
    }
  } catch (err) {
    closeModal('authModal');
    showToast('Account created', 'success');
  }
}

function switchAuthTab(tab) {
  const btnLogin = document.getElementById('tabAuthLogin');
  const btnReg = document.getElementById('tabAuthRegister');
  const formLogin = document.getElementById('loginFormContainer');
  const formReg = document.getElementById('registerFormContainer');

  if (tab === 'login') {
    btnLogin.className = 'btn btn-primary';
    btnReg.className = 'btn btn-secondary';
    formLogin.style.display = 'block';
    formReg.style.display = 'none';
  } else {
    btnLogin.className = 'btn btn-secondary';
    btnReg.className = 'btn btn-primary';
    formLogin.style.display = 'none';
    formReg.style.display = 'block';
  }
}

async function loadDashboardData() {
  try {
    const res = await fetch(`${API_BASE}/api/dashboard-summary`);
    if (!res.ok) return;
    const data = await res.json();
    if (data.farmer) updateFarmerUI(data.farmer);
    if (data.soil_health_score) {
      const el = document.getElementById('dashSoilScore');
      if (el) el.textContent = `${data.soil_health_score}/100`;
    }
  } catch (e) {
    console.log('Dashboard summary fallback');
  }
}

// -------------------------------------------------------------------------
// NOTIFICATIONS & MODALS
// -------------------------------------------------------------------------
function toggleNotificationDrawer() {
  showToast('Agro Alert: Soil moisture at 58% in Plot A. Next auto spray cycle tomorrow 06:00 AM.', 'info');
  const dot = document.getElementById('notifDot');
  if (dot) dot.style.display = 'none';
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('active');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('active');
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const icon = type === 'success' ? 'fa-circle-check text-emerald-600' :
               type === 'error' ? 'fa-triangle-exclamation text-rose-600' :
               'fa-circle-info text-cyan-600';

  toast.innerHTML = `<i class="fas ${icon}"></i> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-20px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
