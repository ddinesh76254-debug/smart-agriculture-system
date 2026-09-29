# 🌱 Smart Agriculture System — AI Precision Agronomy & Farm OS

An AI-driven precision agriculture web platform combining **Scikit-learn Machine Learning**, real-time **Open-Meteo climate feeds**, and **evapotranspiration water modeling** to deliver precision crop recommendations, soil health diagnostics, and smart irrigation planning.

![Smart Agriculture System Preview](https://img.shields.io/badge/Status-Active-brightgreen)
![Python 3.11+](https://img.shields.io/badge/Python-3.11+-3776ab?logo=python&logoColor=white)
![Flask](https://img.shields.io/badge/Backend-Flask-000000?logo=flask&logoColor=white)
![Scikit--Learn](https://img.shields.io/badge/ML-Scikit--Learn-f7931e?logo=scikit-learn&logoColor=white)
![Chart.js](https://img.shields.io/badge/Charts-Chart.js-ff6384?logo=chartdotjs&logoColor=white)

---

## 🌟 Core Features

- 🌾 **AI Crop Recommendation Engine**: Scikit-learn Random Forest model predicting top matching crops across 22+ agricultural varieties based on Nitrogen (N), Phosphorus (P), Potassium (K), Soil pH, Moisture, Temperature, Humidity, and Rainfall.
- 🧪 **Soil Health & Laboratory Diagnostics**: Real-time NPK & pH diagnostic meters with actionable organic/inorganic soil amendment plans.
- 💧 **Smart Irrigation Planner**: Calculates precise irrigation water deficit (mm & Liters) and farm pump runtime (hours & minutes), with automatic weather-delay alerts if rain (>5mm) is forecasted in the next 24-48 hours.
- 🌦️ **Precision Weather Station**: Real-time Open-Meteo satellite & radar agro-meteorology with 5-day daily forecast strips and 24-hour temperature/rain probability trend graphs.
- 📊 **Interactive Analytics (Chart.js)**: Soil NPK radar charts, 24-hour temperature vs precipitation curves, and historical pH/moisture trends.
- 📈 **Farm History & Audit**: Plot-level soil test logs and past recommendations with one-click **CSV export**.
- 👨🌾 **Farmer Profile & Authentication**: Secure user registration, login, and land acreage configuration.

---

## 🏗️ System Architecture

```text
               ┌────────────────────────────────────────────────────────┐
               │           Farmer UI / UX Frontend Interface            │
               │ (Luxury Dark Emerald + Glassmorphism + Chart.js)       │
               └───────────────────────────┬────────────────────────────┘
                                           │ HTTP / REST API
                                           ▼
               ┌────────────────────────────────────────────────────────┐
               │                  Python Flask Backend                  │
               │        (Session Auth, REST Endpoints, Routing)         │
               └──────┬────────────────────┬────────────────────┬───────┘
                      │                    │                    │
                      ▼                    ▼                    ▼
        ┌───────────────────┐    ┌───────────────────┐    ┌───────────────────┐
        │   SQLite DB       │    │  Scikit-learn ML  │    │  Open-Meteo API   │
        │  (SQLAlchemy)     │    │   Crop & Water    │    │  (Live Forecast & │
        │ Farmers, Soil,    │    │ Recommendation    │    │   Precipitation)  │
        │ Crops, History    │    │      Engine       │    │                   │
        └───────────────────┘    └───────────────────┘    └───────────────────┘
```

---

## 📁 Repository Structure

```text
├── app.py                  # Flask web server & REST API controller
├── models.py               # SQLAlchemy database models (Farmers, SoilData, Crops, Recommendations)
├── ml_engine.py            # Scikit-learn Random Forest crop prediction & agronomic evaluator
├── irrigation_engine.py    # Evapotranspiration & agricultural pump scheduling engine
├── weather_service.py      # Open-Meteo API integration & forecast handler
├── requirements.txt        # Python package dependencies
├── test_system.py          # Automated unit & integration test suite
├── standalone_preview.html # Zero-dependency browser preview UI
├── templates/
│   └── index.html          # Single-Page web application
└── static/
    ├── css/
    │   └── styles.css      # Luxury Agro-Tech design system stylesheet
    └── js/
        └── app.js          # Client-side controller & Chart.js renderer
```

---

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/<your-username>/smart-agriculture-system.git
cd smart-agriculture-system
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Start the Application
```bash
python app.py
```
Open your browser and navigate to: **`http://127.0.0.1:5000`**

---

## 🧪 Run Tests
To verify all models and APIs:
```bash
python test_system.py
```

---

## 📄 License
This project is licensed under the MIT License.
