/**
 * SMART AGRICULTURE SYSTEM — FRONTEND CONTROLLER
 * Full SPA Routing, Chart.js integrations, ML inference & live weather sync
 */

const API_BASE = '';
let currentFarmer = null;
let liveWeatherData = null;
let charts = {};

// Soil Presets for Quick Testing
const SOIL_PRESETS = {
  black_cotton: { n: 120, p: 48, k: 25, ph: 7.2, moisture: 55, organic: 2.8, name: "Black Cotton Soil (Deccan)" },
  alluvial_grain: { n: 85, p: 45, k: 42, ph: 6.8, moisture: 60, organic: 3.0, name: "Alluvial Fertile Loam (Plains)" },
  red_sandy: { n: 35, p: 60, k: 75, ph: 6.2, moisture: 38, organic: 1.8, name: "Red Sandy Loam (Legumes/Pulses)" },
  arid_dryland: { n: 25, p: 22, k: 40, ph: 7.8, moisture: 25, organic: 1.2, name: "Arid Semi-Dryland (Pomegranate/Melon)" },
  coastal_humid: { n: 95, p: 55, k: 45, ph: 6.0, moisture: 75, organic: 3.5, name: "Coastal Humid Wet (Paddy/Banana)" }
};

document.addEventListener('DOMContentLoaded', () => {
  initApp();
  initNavigation();
  initSliderSync();
  initModals();
});

async function initApp() {
  await checkAuthStatus();
  await loadDashboardData();
  await loadWeatherData();
}

// -------------------------------------------------------------------------
// NAVIGATION & VIEWS
// -------------------------------------------------------------------------
function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const targetView = item.getAttribute('data-view');
      if (targetView) {
        switchView(targetView);
      }
    });
  });

  const mobileToggle = document.getElementById('mobileToggle');
  const sidebar = document.querySelector('.sidebar');
  if (mobileToggle && sidebar) {
    mobileToggle.addEventListener('click', () => {
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

  // Trigger view specific reloads
  if (viewId === 'history') loadHistoryData();
  if (viewId === 'soil-health') renderSoilRadarChart();
  if (viewId === 'weather') renderWeatherHourlyChart();

  // Close mobile sidebar if open
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) sidebar.classList.remove('open');
}

// -------------------------------------------------------------------------
// SLIDER & INPUT SYNCHRONIZATION
// -------------------------------------------------------------------------
function initSliderSync() {
  const sliders = [
    { slider: 'slider-n', badge: 'badge-n', input: 'input-n' },
    { slider: 'slider-p', badge: 'badge-p', input: 'input-p' },
    { slider: 'slider-k', badge: 'badge-k', input: 'input-k' },
    { slider: 'slider-ph', badge: 'badge-ph', input: 'input-ph' },
    { slider: 'slider-moisture', badge: 'badge-moisture', input: 'input-moisture' }
  ];

  sliders.forEach(s => {
    const sliderEl = document.getElementById(s.slider);
    const badgeEl = document.getElementById(s.badge);
    const inputEl = document.getElementById(s.input);

    if (sliderEl && badgeEl) {
      sliderEl.addEventListener('input', (e) => {
        badgeEl.textContent = e.target.value;
        if (inputEl) inputEl.value = e.target.value;
      });
    }

    if (inputEl && sliderEl && badgeEl) {
      inputEl.addEventListener('input', (e) => {
        sliderEl.value = e.target.value;
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
    const i = document.getElementById(`input-${id}`);
    if (s) s.value = val;
    if (b) b.textContent = val;
    if (i) i.value = val;
  };

  setVal('n', p.n);
  setVal('p', p.p);
  setVal('k', p.k);
  setVal('ph', p.ph);
  setVal('moisture', p.moisture);

  showToast(`Applied preset: ${p.name}`, 'info');
}

// -------------------------------------------------------------------------
// AUTHENTICATION & USER PROFILE
// -------------------------------------------------------------------------
async function checkAuthStatus() {
  try {
    const res = await fetch(`${API_BASE}/api/auth/me`);
    const data = await res.json();
    if (data.authenticated && data.farmer) {
      currentFarmer = data.farmer;
      updateFarmerUI(currentFarmer);
    }
  } catch (err) {
    console.error('Auth check error:', err);
  }
}

function updateFarmerUI(farmer) {
  if (!farmer) return;
  document.getElementById('farmerNameDisplay').textContent = farmer.name;
  document.getElementById('farmerLocationDisplay').textContent = farmer.location;
  document.getElementById('sidebarFarmerName').textContent = farmer.name;
  document.getElementById('sidebarFarmerLoc').textContent = farmer.location;

  // Fill profile form
  const setElVal = (id, val) => {
    const el = document.getElementById(id);
    if (el && val !== undefined) el.value = val;
  };
  setElVal('profName', farmer.name);
  setElVal('profEmail', farmer.email);
  setElVal('profPhone', farmer.phone);
  setElVal('profLocation', farmer.location);
  setElVal('profAcreage', farmer.farm_size_acres);
  setElVal('profSoilType', farmer.soil_type);
  setElVal('profPrimaryCrop', farmer.primary_crop);
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
    if (res.ok) {
      currentFarmer = data.farmer;
      updateFarmerUI(currentFarmer);
      closeModal('authModal');
      showToast('Logged in successfully! Welcome back.', 'success');
      loadDashboardData();
    } else {
      showToast(data.error || 'Login failed', 'error');
    }
  } catch (err) {
    showToast('Network error during login', 'error');
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById('regName').value;
  const email = document.getElementById('regEmail').value;
  const password = document.getElementById('regPassword').value;
  const phone = document.getElementById('regPhone').value;
  const location = document.getElementById('regLocation').value;
  const farm_size_acres = document.getElementById('regAcreage').value;
  const soil_type = document.getElementById('regSoilType').value;
  const primary_crop = document.getElementById('regCrop').value;

  try {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, phone, location, farm_size_acres, soil_type, primary_crop })
    });
    const data = await res.json();
    if (res.ok) {
      currentFarmer = data.farmer;
      updateFarmerUI(currentFarmer);
      closeModal('authModal');
      showToast('Account registered successfully! Welcome.', 'success');
      loadDashboardData();
    } else {
      showToast(data.error || 'Registration failed', 'error');
    }
  } catch (err) {
    showToast('Network error during registration', 'error');
  }
}

async function handleProfileSave(e) {
  e.preventDefault();
  const payload = {
    name: document.getElementById('profName').value,
    phone: document.getElementById('profPhone').value,
    location: document.getElementById('profLocation').value,
    farm_size_acres: document.getElementById('profAcreage').value,
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
    if (res.ok) {
      currentFarmer = data.farmer;
      updateFarmerUI(currentFarmer);
      showToast('Farm profile updated successfully!', 'success');
      loadWeatherData();
      loadDashboardData();
    } else {
      showToast(data.error || 'Failed to update profile', 'error');
    }
  } catch (err) {
    showToast('Error updating profile', 'error');
  }
}

// -------------------------------------------------------------------------
// DASHBOARD & SUMMARY
// -------------------------------------------------------------------------
async function loadDashboardData() {
  try {
    const res = await fetch(`${API_BASE}/api/dashboard-summary`);
    const data = await res.json();
    if (!res.ok) return;

    // Health Score
    document.getElementById('dashSoilScore').textContent = `${data.soil_health_score}/100`;
    
    // Moisture
    const moist = data.latest_soil ? data.latest_soil.moisture : 58.0;
    document.getElementById('dashMoisture').textContent = `${moist.toFixed(1)}%`;
    
    // Irrigation Status Badge
    const irr = data.irrigation_summary;
    const irrBadge = document.getElementById('dashIrrigationBadge');
    irrBadge.textContent = irr.status_label;
    irrBadge.className = `badge ${irr.badge_color}`;
    document.getElementById('dashIrrigationDesc').textContent = irr.action_summary;

    // Recent Crop Advice
    if (data.latest_recommendation) {
      document.getElementById('dashRecentCrop').textContent = data.latest_recommendation.crop;
      document.getElementById('dashRecentCropScore').innerHTML = `<i class="fas fa-star text-amber-400"></i> ${data.latest_recommendation.confidence_score}% Match`;
    }

    // Update Quick Soil Diagnostics
    if (data.latest_soil) {
      updateSoilDashboardGauges(data.latest_soil);
    }
  } catch (err) {
    console.error('Error loading dashboard summary:', err);
  }
}

function updateSoilDashboardGauges(soil) {
  const setEl = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  setEl('dash-val-n', `${soil.nitrogen} mg/kg`);
  setEl('dash-val-p', `${soil.phosphorus} mg/kg`);
  setEl('dash-val-k', `${soil.potassium} mg/kg`);
  setEl('dash-val-ph', `${soil.ph}`);
}

// -------------------------------------------------------------------------
// WEATHER MODULE (Open-Meteo)
// -------------------------------------------------------------------------
async function loadWeatherData(cityName = null) {
  try {
    let url = `${API_BASE}/api/weather`;
    if (cityName) {
      url += `?city=${encodeURIComponent(cityName)}`;
    } else if (currentFarmer && currentFarmer.location) {
      url += `?city=${encodeURIComponent(currentFarmer.location)}`;
    }

    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) return;

    liveWeatherData = data;
    renderWeatherWidgets(data);
  } catch (err) {
    console.error('Error loading weather data:', err);
  }
}

function renderWeatherWidgets(w) {
  // Top Header Pill
  const pillTemp = document.getElementById('headerWeatherTemp');
  const pillDesc = document.getElementById('headerWeatherDesc');
  const pillIcon = document.getElementById('headerWeatherIcon');
  if (pillTemp) pillTemp.textContent = `${w.temperature}°C`;
  if (pillDesc) pillDesc.textContent = w.weather_condition;
  if (pillIcon) pillIcon.className = `fas ${w.weather_icon || 'fa-cloud-sun'}`;

  // Dashboard Weather Box
  const dashLoc = document.getElementById('dashWeatherLoc');
  const dashTemp = document.getElementById('dashWeatherTemp');
  const dashCondition = document.getElementById('dashWeatherCondition');
  const dashRainRisk = document.getElementById('dashWeatherRainRisk');
  const dashHumidity = document.getElementById('dashWeatherHumidity');
  const dashWind = document.getElementById('dashWeatherWind');

  if (dashLoc) dashLoc.textContent = w.location;
  if (dashTemp) dashTemp.textContent = `${w.temperature}°C`;
  if (dashCondition) dashCondition.textContent = w.weather_desc;
  if (dashRainRisk) dashRainRisk.textContent = `${w.rain_next_24h_mm} mm`;
  if (dashHumidity) dashHumidity.textContent = `${w.humidity}%`;
  if (dashWind) dashWind.textContent = `${w.wind_speed_kmh} km/h`;

  // 5-Day Forecast Grid
  const forecastGrid = document.getElementById('weatherForecastGrid');
  if (forecastGrid && w.forecast) {
    forecastGrid.innerHTML = w.forecast.map(day => `
      <div class="forecast-col">
        <span class="forecast-day">${day.day_label}</span>
        <i class="fas ${day.icon} forecast-icon"></i>
        <div class="forecast-temps">${Math.round(day.temp_max)}° / ${Math.round(day.temp_min)}°</div>
        <span class="badge ${day.rain_prob_pct > 40 ? 'blue' : 'green'}" style="font-size: 0.68rem; padding: 2px 6px;">
          ${day.rain_prob_pct}% rain
        </span>
      </div>
    `).join('');
  }

  // Auto-sync into Crop Rec form if empty
  const recTemp = document.getElementById('input-rec-temp');
  const recHum = document.getElementById('input-rec-hum');
  const recRain = document.getElementById('input-rec-rain');
  if (recTemp && !recTemp.value) recTemp.value = w.temperature;
  if (recHum && !recHum.value) recHum.value = w.humidity;
  if (recRain && !recRain.value) recRain.value = 750;

  renderWeatherHourlyChart();
}

function syncWeatherToCropForm() {
  if (!liveWeatherData) {
    showToast('Fetching weather first...', 'info');
    loadWeatherData();
    return;
  }
  document.getElementById('input-rec-temp').value = liveWeatherData.temperature;
  document.getElementById('input-rec-hum').value = liveWeatherData.humidity;
  document.getElementById('input-rec-rain').value = liveWeatherData.rain_next_24h_mm > 0 ? liveWeatherData.rain_next_24h_mm * 100 : 750;
  showToast(`Synced local climate from ${liveWeatherData.location}`, 'success');
}

// -------------------------------------------------------------------------
// ML CROP RECOMMENDATION ENGINE
// -------------------------------------------------------------------------
async function handleCropRecommendation(e) {
  if (e) e.preventDefault();

  const n = parseFloat(document.getElementById('slider-n').value);
  const p = parseFloat(document.getElementById('slider-p').value);
  const k = parseFloat(document.getElementById('slider-k').value);
  const ph = parseFloat(document.getElementById('slider-ph').value);
  const moisture = parseFloat(document.getElementById('slider-moisture').value);
  const temperature = parseFloat(document.getElementById('input-rec-temp').value) || 26.0;
  const humidity = parseFloat(document.getElementById('input-rec-hum').value) || 65.0;
  const rainfall = parseFloat(document.getElementById('input-rec-rain').value) || 750.0;
  const forecastRain = liveWeatherData ? liveWeatherData.rain_next_24h_mm : 0.0;

  const btn = document.getElementById('btnRunCropRec');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Running ML Inference...';
  }

  try {
    const res = await fetch(`${API_BASE}/api/recommend-crop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nitrogen: n, phosphorus: p, potassium: k, ph: ph, moisture: moisture,
        temperature: temperature, humidity: humidity, rainfall: rainfall,
        forecast_rain_mm: forecastRain, save_to_history: true
      })
    });

    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Failed to generate recommendation', 'error');
      return;
    }

    renderCropRecommendationResults(data);
    showToast('ML Recommendation completed!', 'success');
  } catch (err) {
    showToast('Inference request failed', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-microchip"></i> Predict Best Crops (ML Engine)';
    }
  }
}

function renderCropRecommendationResults(data) {
  const container = document.getElementById('cropResultsContainer');
  if (!container) return;

  const crops = data.all_recommendations;
  if (!crops || crops.length === 0) {
    container.innerHTML = '<p style="color: var(--text-secondary); text-align: center;">No crop match found for these parameters.</p>';
    return;
  }

  const top = crops[0];
  const irr = data.irrigation_plan;

  let html = `
    <div class="crop-card highlight mb-4">
      <div class="crop-card-header">
        <div class="crop-title-group">
          <span class="crop-emoji">${top.icon}</span>
          <div>
            <h3 style="font-size: 1.35rem; font-weight: 800; color: var(--neon-emerald-bright);">${top.crop_name}</h3>
            <span class="badge green"><i class="fas fa-calendar-alt"></i> ${top.season}</span>
            <span class="badge blue"><i class="fas fa-tint"></i> ${top.water_requirement} Water</span>
          </div>
        </div>
        <div style="text-align: right;">
          <div class="crop-score">${top.confidence_score}%</div>
          <span style="font-size: 0.74rem; color: var(--neon-emerald-bright); font-weight: 700;">MATCH SCORE</span>
        </div>
      </div>

      <div class="progress-container">
        <div class="progress-bar" style="width: ${top.confidence_score}%"></div>
      </div>

      <div style="background: rgba(0, 245, 155, 0.1); border: 1px solid rgba(0,245,155,0.25); border-radius: 10px; padding: 14px; margin-top: 6px; font-size: 0.9rem; color: #a7f3d0;">
        <strong><i class="fas fa-check-circle text-emerald-400"></i> Agronomic Advisory:</strong> ${top.suitability_notes}
      </div>

      <div style="background: rgba(6, 182, 212, 0.1); border: 1px solid rgba(6,182,212,0.25); border-radius: 10px; padding: 14px; font-size: 0.88rem; color: #bae6fd;">
        <strong><i class="fas fa-faucet-drip text-cyan-400"></i> Irrigation Plan:</strong> ${irr.action_summary}
        <div style="margin-top: 6px; font-size: 0.82rem; color: #94a3b8;">
          Pump runtime: <strong style="color: #67e8f9;">${irr.pump_hours_needed} hrs</strong> (${irr.pump_minutes_needed} mins) • Method: <strong style="color: #67e8f9;">${irr.recommended_method}</strong>
        </div>
      </div>
    </div>

    <h4 style="font-size: 1rem; font-weight: 800; margin: 20px 0 12px 0; color: var(--text-primary);">Alternative Recommended Crops</h4>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 14px;">
  `;

  crops.slice(1).forEach(c => {
    html += `
      <div class="crop-card">
        <div class="crop-card-header">
          <div class="crop-title-group">
            <span style="font-size: 26px;">${c.icon}</span>
            <div>
              <div style="font-weight: 800; font-size: 0.98rem;">${c.crop_name}</div>
              <span style="font-size: 0.74rem; color: var(--text-secondary);">${c.season}</span>
            </div>
          </div>
          <span class="badge green" style="font-size: 0.84rem; font-family: var(--font-mono);">${c.confidence_score}%</span>
        </div>
        <div class="progress-container" style="height: 5px;">
          <div class="progress-bar" style="width: ${c.confidence_score}%"></div>
        </div>
        <div style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.5;">${c.suitability_notes}</div>
      </div>
    `;
  });

  html += `</div>`;
  container.innerHTML = html;

  // Render crop probability distribution chart
  renderCropProbabilityChart(crops);
}

// -------------------------------------------------------------------------
// SOIL HEALTH MODULE & GAUGES
// -------------------------------------------------------------------------
async function handleSoilSave(e) {
  e.preventDefault();
  const ph = parseFloat(document.getElementById('soilFormPh').value);
  const n = parseFloat(document.getElementById('soilFormN').value);
  const p = parseFloat(document.getElementById('soilFormP').value);
  const k = parseFloat(document.getElementById('soilFormK').value);
  const moisture = parseFloat(document.getElementById('soilFormMoisture').value);
  const org = parseFloat(document.getElementById('soilFormOrg').value) || 2.5;
  const notes = document.getElementById('soilFormNotes').value;

  try {
    const res = await fetch(`${API_BASE}/api/soil`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ph, nitrogen: n, phosphorus: p, potassium: k, moisture, organic_matter: org, notes })
    });
    const data = await res.json();
    if (res.ok) {
      showToast('Soil test recorded successfully!', 'success');
      renderSoilHealthReport(data.health_report, data.soil_record);
      loadDashboardData();
    } else {
      showToast(data.error || 'Failed to save soil test', 'error');
    }
  } catch (err) {
    showToast('Network error saving soil test', 'error');
  }
}

function renderSoilHealthReport(report, soil) {
  const container = document.getElementById('soilReportContainer');
  if (!container) return;

  const a = report.analysis;
  container.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
      <div>
        <h3 style="font-size: 1.25rem; font-weight: 800;">Soil Health Diagnostics</h3>
        <p style="font-size: 0.84rem; color: var(--text-secondary);">Fertility quality rating and macro-nutrient balance</p>
      </div>
      <div style="font-size: 2.2rem; font-weight: 900; font-family: var(--font-mono); color: var(--neon-emerald-bright);">${report.score} / 100</div>
    </div>

    <div class="soil-gauge-grid mb-4">
      <div class="gauge-item">
        <div class="gauge-name">pH Level</div>
        <div class="gauge-val" style="color: ${a.ph.color === 'green' ? '#00f59b' : '#fbbf24'}">${soil.ph}</div>
        <span class="badge ${a.ph.color}">${a.ph.status}</span>
      </div>

      <div class="gauge-item">
        <div class="gauge-name">Nitrogen (N)</div>
        <div class="gauge-val" style="color: ${a.nitrogen.color === 'green' ? '#00f59b' : '#fbbf24'}">${soil.nitrogen} <span style="font-size:0.75rem">mg/kg</span></div>
        <span class="badge ${a.nitrogen.color}">${a.nitrogen.status}</span>
      </div>

      <div class="gauge-item">
        <div class="gauge-name">Phosphorus (P)</div>
        <div class="gauge-val" style="color: ${a.phosphorus.color === 'green' ? '#00f59b' : '#fbbf24'}">${soil.phosphorus} <span style="font-size:0.75rem">mg/kg</span></div>
        <span class="badge ${a.phosphorus.color}">${a.phosphorus.status}</span>
      </div>

      <div class="gauge-item">
        <div class="gauge-name">Potassium (K)</div>
        <div class="gauge-val" style="color: ${a.potassium.color === 'green' ? '#00f59b' : '#fbbf24'}">${soil.potassium} <span style="font-size:0.75rem">mg/kg</span></div>
        <span class="badge ${a.potassium.color}">${a.potassium.status}</span>
      </div>

      <div class="gauge-item">
        <div class="gauge-name">Moisture</div>
        <div class="gauge-val" style="color: #67e8f9">${soil.moisture}%</div>
        <span class="badge ${a.moisture.color}">${a.moisture.status}</span>
      </div>
    </div>

    <div style="background: rgba(4, 23, 18, 0.7); border: 1px solid var(--glass-border); border-radius: 12px; padding: 20px;">
      <h4 style="font-size: 1rem; font-weight: 800; margin-bottom: 10px; color: var(--neon-emerald-bright);">
        <i class="fas fa-hand-holding-seedling"></i> Recommended Soil Amendments & Prescriptions
      </h4>
      <ul style="padding-left: 20px; font-size: 0.9rem; color: var(--text-primary); line-height: 1.7;">
        ${report.recommendations.map(r => `<li>${r}</li>`).join('')}
      </ul>
    </div>
  `;

  renderSoilRadarChart(soil);
}

// -------------------------------------------------------------------------
// SMART IRRIGATION CALCULATOR
// -------------------------------------------------------------------------
async function handleIrrigationPlanner(e) {
  if (e) e.preventDefault();

  const moisture = parseFloat(document.getElementById('irrMoistureInput').value);
  const crop = document.getElementById('irrCropSelect').value;
  const soilType = document.getElementById('irrSoilTypeSelect').value;
  const acreage = parseFloat(document.getElementById('irrAcreageInput').value) || 5.0;
  const rainForecast = liveWeatherData ? liveWeatherData.rain_next_24h_mm : 0.0;

  try {
    const res = await fetch(`${API_BASE}/api/irrigation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        moisture: moisture,
        crop_name: crop,
        soil_type: soilType,
        farm_size_acres: acreage,
        forecast_rain_mm: rainForecast,
        temperature: liveWeatherData ? liveWeatherData.temperature : 28.0,
        humidity: liveWeatherData ? liveWeatherData.humidity : 60.0
      })
    });

    const data = await res.json();
    if (!res.ok) return;

    renderIrrigationResults(data);
  } catch (err) {
    showToast('Failed to calculate irrigation schedule', 'error');
  }
}

function renderIrrigationResults(data) {
  const container = document.getElementById('irrigationResultsBox');
  if (!container) return;

  container.innerHTML = `
    <div class="card card-hero-glow">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 44px; height: 44px; border-radius: 50%; background: rgba(6, 182, 212, 0.2); color: #67e8f9; display: flex; align-items: center; justify-content: center; font-size: 20px; border: 1px solid rgba(6, 182, 212, 0.4);">
            <i class="fas fa-tint"></i>
          </div>
          <div>
            <h3 style="font-size: 1.2rem; font-weight: 800; color: #e0f2fe;">Smart Irrigation Schedule</h3>
            <span class="badge ${data.badge_color}">${data.status_label}</span>
          </div>
        </div>
        <div style="text-align: right;">
          <span style="font-size: 0.74rem; color: var(--text-secondary); font-weight: 700;">URGENCY</span>
          <div style="font-weight: 800; font-size: 1.15rem; color: var(--neon-emerald-bright);">${data.urgency}</div>
        </div>
      </div>

      <p style="font-size: 0.95rem; color: var(--text-primary); line-height: 1.6; margin-bottom: 18px;">
        ${data.action_summary}
      </p>

      <div class="stats-grid" style="grid-template-columns: repeat(3, 1fr); margin-bottom: 18px; gap: 14px;">
        <div style="background: rgba(4, 23, 18, 0.7); border: 1px solid var(--glass-border); border-radius: var(--radius-md); padding: 14px; text-align: center;">
          <div style="font-size: 0.76rem; color: var(--text-secondary);">Pump Runtime</div>
          <div style="font-size: 1.4rem; font-weight: 800; font-family: var(--font-mono); color: #67e8f9;">${data.pump_hours_needed} hrs</div>
          <div style="font-size: 0.74rem; color: var(--text-muted);">${data.pump_minutes_needed} mins</div>
        </div>
        <div style="background: rgba(4, 23, 18, 0.7); border: 1px solid var(--glass-border); border-radius: var(--radius-md); padding: 14px; text-align: center;">
          <div style="font-size: 0.76rem; color: var(--text-secondary);">Water Volume</div>
          <div style="font-size: 1.4rem; font-weight: 800; font-family: var(--font-mono); color: var(--neon-emerald-bright);">${data.total_water_liters.toLocaleString()}</div>
          <div style="font-size: 0.74rem; color: var(--text-muted);">Liters (${data.water_deficit_mm} mm)</div>
        </div>
        <div style="background: rgba(4, 23, 18, 0.7); border: 1px solid var(--glass-border); border-radius: var(--radius-md); padding: 14px; text-align: center;">
          <div style="font-size: 0.76rem; color: var(--text-secondary);">Best Window</div>
          <div style="font-size: 0.95rem; font-weight: 700; color: #fbbf24; margin-top: 6px;">${data.best_irrigation_window}</div>
        </div>
      </div>

      <div style="font-size: 0.88rem; color: #bae6fd; background: rgba(6, 182, 212, 0.12); border: 1px solid rgba(6, 182, 212, 0.3); padding: 12px 16px; border-radius: var(--radius-md);">
        <i class="fas fa-leaf text-emerald-400"></i> <strong>Eco & Water Conservation:</strong> ${data.savings_message}
      </div>
    </div>
  `;
}

// -------------------------------------------------------------------------
// HISTORY MODULE & LOGS
// -------------------------------------------------------------------------
async function loadHistoryData() {
  try {
    const res = await fetch(`${API_BASE}/api/history`);
    const data = await res.json();
    if (!res.ok) return;

    renderSoilHistoryTable(data.soil_history || []);
    renderRecommendationHistoryTable(data.recommendation_history || []);
    renderSoilTrendChart(data.soil_history || []);
  } catch (err) {
    console.error('Error loading history:', err);
  }
}

function renderSoilHistoryTable(logs) {
  const tbody = document.getElementById('soilHistoryTbody');
  if (!tbody) return;

  if (logs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 25px; color: var(--text-secondary);">No soil records logged yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = logs.map(s => `
    <tr>
      <td><strong style="font-family: var(--font-mono);">${s.test_date}</strong></td>
      <td><span class="badge green">pH ${s.ph}</span></td>
      <td>${s.nitrogen} mg/kg</td>
      <td>${s.phosphorus} mg/kg</td>
      <td>${s.potassium} mg/kg</td>
      <td><span class="badge blue">${s.moisture}%</span></td>
      <td>
        <button class="btn btn-secondary" style="padding: 5px 12px; font-size: 0.78rem;" onclick="deleteSoilLog(${s.soil_id})">
          <i class="fas fa-trash text-red-400"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

function renderRecommendationHistoryTable(recs) {
  const tbody = document.getElementById('recHistoryTbody');
  if (!tbody) return;

  if (recs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 25px; color: var(--text-secondary);">No recommendations saved yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = recs.map(r => `
    <tr>
      <td><strong style="font-family: var(--font-mono);">${r.date}</strong></td>
      <td><strong style="color: var(--neon-emerald-bright);">${r.crop}</strong></td>
      <td><span class="badge green" style="font-family: var(--font-mono);">${r.confidence_score}%</span></td>
      <td><span class="badge amber" style="font-family: var(--font-mono);">${r.soil_health_score}/100</span></td>
      <td style="max-width: 250px; font-size: 0.82rem; color: var(--text-secondary);">${r.irrigation}</td>
      <td>
        <button class="btn btn-secondary" style="padding: 5px 12px; font-size: 0.78rem;" onclick="deleteRecLog(${r.recommendation_id})">
          <i class="fas fa-trash text-red-400"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

async function deleteSoilLog(id) {
  if (!confirm('Are you sure you want to delete this soil log?')) return;
  try {
    const res = await fetch(`${API_BASE}/api/history/soil/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Soil log deleted', 'info');
      loadHistoryData();
      loadDashboardData();
    }
  } catch (err) {
    showToast('Failed to delete log', 'error');
  }
}

async function deleteRecLog(id) {
  if (!confirm('Are you sure you want to delete this recommendation record?')) return;
  try {
    const res = await fetch(`${API_BASE}/api/history/recommendation/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Record deleted', 'info');
      loadHistoryData();
    }
  } catch (err) {
    showToast('Failed to delete record', 'error');
  }
}

function exportHistoryCSV() {
  fetch(`${API_BASE}/api/history`)
    .then(r => r.json())
    .then(data => {
      const rows = [
        ['Type', 'Date', 'Crop / pH', 'Nitrogen', 'Phosphorus', 'Potassium', 'Moisture', 'Notes']
      ];

      (data.soil_history || []).forEach(s => {
        rows.push(['Soil Test', s.test_date, s.ph, s.nitrogen, s.phosphorus, s.potassium, s.moisture, s.notes || '']);
      });

      (data.recommendation_history || []).forEach(r => {
        rows.push(['Crop Rec', r.date, r.crop, r.confidence_score, r.soil_health_score, '', '', r.irrigation]);
      });

      let csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.map(i => `"${i}"`).join(",")).join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `smart_agri_history_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Exported CSV successfully!', 'success');
    });
}

// -------------------------------------------------------------------------
// CHART.JS VISUALIZATIONS (Luxe Agro Dark Theme)
// -------------------------------------------------------------------------
function renderSoilRadarChart(soil = null) {
  const ctx = document.getElementById('soilRadarCanvas');
  if (!ctx) return;

  const currentN = soil ? soil.nitrogen : (parseFloat(document.getElementById('slider-n')?.value) || 85);
  const currentP = soil ? soil.phosphorus : (parseFloat(document.getElementById('slider-p')?.value) || 48);
  const currentK = soil ? soil.potassium : (parseFloat(document.getElementById('slider-k')?.value) || 52);
  const currentMoist = soil ? soil.moisture : (parseFloat(document.getElementById('slider-moisture')?.value) || 58);
  const currentPhNorm = (soil ? soil.ph : (parseFloat(document.getElementById('slider-ph')?.value) || 6.8)) * 10;

  if (charts.soilRadar) charts.soilRadar.destroy();

  charts.soilRadar = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['Nitrogen (N)', 'Phosphorus (P)', 'Potassium (K)', 'Moisture (%)', 'pH (x10)'],
      datasets: [
        {
          label: 'Current Soil Sample',
          data: [currentN, currentP, currentK, currentMoist, currentPhNorm],
          backgroundColor: 'rgba(0, 245, 155, 0.25)',
          borderColor: '#00f59b',
          pointBackgroundColor: '#00f59b',
          pointBorderColor: '#ffffff',
          pointHoverRadius: 6,
          borderWidth: 2.5
        },
        {
          label: 'Ideal Loam Benchmark',
          data: [80, 50, 50, 60, 68],
          backgroundColor: 'rgba(6, 182, 212, 0.1)',
          borderColor: '#06b6d4',
          borderDash: [4, 4],
          borderWidth: 1.8
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          min: 0,
          max: 150,
          grid: { color: 'rgba(52, 211, 153, 0.15)' },
          angleLines: { color: 'rgba(52, 211, 153, 0.15)' },
          pointLabels: {
            color: '#a7f3d0',
            font: { family: "'Plus Jakarta Sans', sans-serif", size: 12, weight: 'bold' }
          },
          ticks: { display: false }
        }
      },
      plugins: {
        legend: {
          labels: { color: '#f0fdf4', font: { family: "'Plus Jakarta Sans', sans-serif", weight: 'bold' } }
        }
      }
    }
  });
}

function renderCropProbabilityChart(crops) {
  const ctx = document.getElementById('cropProbCanvas');
  if (!ctx) return;

  if (charts.cropProb) charts.cropProb.destroy();

  charts.cropProb = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: crops.map(c => c.crop_name),
      datasets: [{
        label: 'Suitability Probability (%)',
        data: crops.map(c => c.confidence_score),
        backgroundColor: ['#00f59b', '#10b981', '#06b6d4', '#38bdf8'],
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#a7f3d0', font: { family: "'Plus Jakarta Sans', sans-serif", weight: '600' } }
        },
        y: {
          min: 0,
          max: 100,
          grid: { color: 'rgba(255, 255, 255, 0.08)' },
          ticks: { color: '#94a3b8' },
          title: { display: true, text: 'Confidence Score (%)', color: '#94a3b8' }
        }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}

function renderWeatherHourlyChart() {
  const ctx = document.getElementById('weatherHourlyCanvas');
  if (!ctx || !liveWeatherData || !liveWeatherData.hourly) return;

  const hourly = liveWeatherData.hourly.slice(0, 12);
  if (charts.weatherHourly) charts.weatherHourly.destroy();

  charts.weatherHourly = new Chart(ctx, {
    type: 'line',
    data: {
      labels: hourly.map(h => h.time),
      datasets: [
        {
          label: 'Temperature (°C)',
          data: hourly.map(h => h.temp),
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.15)',
          fill: true,
          tension: 0.35,
          borderWidth: 3,
          pointBackgroundColor: '#f59e0b',
          yAxisID: 'y'
        },
        {
          label: 'Rain Probability (%)',
          data: hourly.map(h => h.rain_prob),
          borderColor: '#06b6d4',
          backgroundColor: 'rgba(6, 182, 212, 0.15)',
          fill: true,
          tension: 0.35,
          borderWidth: 3,
          pointBackgroundColor: '#06b6d4',
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.06)' },
          ticks: { color: '#94a3b8', font: { family: "'JetBrains Mono', monospace" } }
        },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          grid: { color: 'rgba(255, 255, 255, 0.06)' },
          ticks: { color: '#fbbf24' },
          title: { display: true, text: 'Temp (°C)', color: '#fbbf24' }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          min: 0,
          max: 100,
          grid: { drawOnChartArea: false },
          ticks: { color: '#67e8f9' },
          title: { display: true, text: 'Rain %', color: '#67e8f9' }
        }
      },
      plugins: {
        legend: {
          labels: { color: '#f0fdf4', font: { family: "'Plus Jakarta Sans', sans-serif", weight: 'bold' } }
        }
      }
    }
  });
}

function renderSoilTrendChart(logs) {
  const ctx = document.getElementById('soilTrendCanvas');
  if (!ctx) return;

  if (charts.soilTrend) charts.soilTrend.destroy();
  if (logs.length === 0) return;

  const reversed = [...logs].reverse();
  charts.soilTrend = new Chart(ctx, {
    type: 'line',
    data: {
      labels: reversed.map(s => s.test_date.slice(5, 10)),
      datasets: [
        {
          label: 'Soil pH',
          data: reversed.map(s => s.ph),
          borderColor: '#00f59b',
          backgroundColor: 'rgba(0, 245, 155, 0.1)',
          borderWidth: 2.5,
          tension: 0.25
        },
        {
          label: 'Moisture (%)',
          data: reversed.map(s => s.moisture),
          borderColor: '#06b6d4',
          backgroundColor: 'rgba(6, 182, 212, 0.1)',
          borderWidth: 2.5,
          tension: 0.25
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.06)' },
          ticks: { color: '#94a3b8' }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.06)' },
          ticks: { color: '#94a3b8' }
        }
      },
      plugins: {
        legend: {
          labels: { color: '#f0fdf4' }
        }
      }
    }
  });
}

// -------------------------------------------------------------------------
// MODAL & TOAST HELPERS
// -------------------------------------------------------------------------
function initModals() {
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('active');
      }
    });
  });
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('active');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('active');
}

function switchAuthTab(tab) {
  const loginForm = document.getElementById('loginFormContainer');
  const regForm = document.getElementById('registerFormContainer');
  const tabLogin = document.getElementById('tabAuthLogin');
  const tabReg = document.getElementById('tabAuthRegister');

  if (tab === 'login') {
    loginForm.style.display = 'block';
    regForm.style.display = 'none';
    tabLogin.classList.add('btn-primary');
    tabLogin.classList.remove('btn-secondary');
    tabReg.classList.add('btn-secondary');
    tabReg.classList.remove('btn-primary');
  } else {
    loginForm.style.display = 'none';
    regForm.style.display = 'block';
    tabReg.classList.add('btn-primary');
    tabReg.classList.remove('btn-secondary');
    tabLogin.classList.add('btn-secondary');
    tabLogin.classList.remove('btn-primary');
  }
}

function showToast(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icon = type === 'success' ? 'fa-circle-check text-emerald-400' : (type === 'error' ? 'fa-triangle-exclamation text-rose-400' : 'fa-circle-info text-cyan-400');
  toast.innerHTML = `<i class="fas ${icon}"></i> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)';
    setTimeout(() => toast.remove(), 350);
  }, 3500);
}
