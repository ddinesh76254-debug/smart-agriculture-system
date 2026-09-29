import os
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline

MODEL_PATH = os.path.join(os.path.dirname(__file__), 'crop_model.joblib')

# Agronomic reference benchmark profiles for 22 agricultural crops
CROP_PROFILES = {
    'Rice (Paddy)': {'N': (80, 100), 'P': (35, 60), 'K': (35, 45), 'temp': (22, 34), 'humidity': (75, 95), 'ph': (5.5, 7.0), 'rainfall': (1200, 2500), 'water_req': 'Very High', 'icon': '🌾', 'season': 'Kharif'},
    'Wheat': {'N': (70, 95), 'P': (35, 50), 'K': (30, 45), 'temp': (12, 25), 'humidity': (50, 70), 'ph': (6.0, 7.5), 'rainfall': (450, 750), 'water_req': 'Moderate', 'icon': '🌾', 'season': 'Rabi'},
    'Maize (Corn)': {'N': (75, 95), 'P': (40, 55), 'K': (40, 50), 'temp': (18, 30), 'humidity': (55, 75), 'ph': (5.8, 7.2), 'rainfall': (500, 900), 'water_req': 'Medium', 'icon': '🌽', 'season': 'Kharif / Spring'},
    'Chickpea': {'N': (30, 50), 'P': (55, 75), 'K': (70, 90), 'temp': (15, 27), 'humidity': (40, 65), 'ph': (6.0, 8.0), 'rainfall': (350, 650), 'water_req': 'Low', 'icon': '🫘', 'season': 'Rabi'},
    'Kidney Beans': {'N': (15, 35), 'P': (55, 75), 'K': (15, 30), 'temp': (15, 25), 'humidity': (50, 65), 'ph': (5.5, 6.5), 'rainfall': (600, 1200), 'water_req': 'Medium', 'icon': '🫘', 'season': 'Kharif / Rabi'},
    'Pigeonpeas': {'N': (15, 35), 'P': (55, 75), 'K': (15, 30), 'temp': (20, 35), 'humidity': (45, 65), 'ph': (6.0, 7.5), 'rainfall': (600, 1000), 'water_req': 'Low', 'icon': '🫘', 'season': 'Kharif'},
    'Mothbeans': {'N': (15, 35), 'P': (35, 55), 'K': (15, 30), 'temp': (25, 35), 'humidity': (40, 60), 'ph': (6.5, 8.0), 'rainfall': (300, 500), 'water_req': 'Very Low', 'icon': '🌱', 'season': 'Kharif'},
    'Mungbean': {'N': (15, 35), 'P': (35, 55), 'K': (15, 30), 'temp': (25, 35), 'humidity': (60, 85), 'ph': (6.2, 7.2), 'rainfall': (600, 900), 'water_req': 'Low', 'icon': '🫘', 'season': 'Kharif / Zaid'},
    'Blackgram': {'N': (35, 55), 'P': (55, 75), 'K': (15, 30), 'temp': (25, 35), 'humidity': (60, 85), 'ph': (6.5, 7.5), 'rainfall': (600, 900), 'water_req': 'Low', 'icon': '🫘', 'season': 'Kharif / Rabi'},
    'Lentil': {'N': (15, 35), 'P': (55, 75), 'K': (15, 30), 'temp': (15, 25), 'humidity': (50, 70), 'ph': (6.0, 7.0), 'rainfall': (350, 550), 'water_req': 'Low', 'icon': '🫘', 'season': 'Rabi'},
    'Pomegranate': {'N': (15, 35), 'P': (15, 30), 'K': (35, 50), 'temp': (18, 38), 'humidity': (35, 60), 'ph': (6.5, 8.0), 'rainfall': (300, 700), 'water_req': 'Low', 'icon': '🍎', 'season': 'Annual'},
    'Banana': {'N': (95, 120), 'P': (70, 90), 'K': (45, 60), 'temp': (24, 34), 'humidity': (75, 90), 'ph': (5.8, 7.2), 'rainfall': (900, 1800), 'water_req': 'High', 'icon': '🍌', 'season': 'Annual'},
    'Mango': {'N': (15, 35), 'P': (20, 35), 'K': (25, 40), 'temp': (24, 36), 'humidity': (50, 75), 'ph': (5.5, 7.5), 'rainfall': (700, 1400), 'water_req': 'Medium', 'icon': '🥭', 'season': 'Summer / Annual'},
    'Grapes': {'N': (15, 35), 'P': (120, 145), 'K': (190, 210), 'temp': (15, 32), 'humidity': (60, 85), 'ph': (5.5, 7.0), 'rainfall': (500, 900), 'water_req': 'Medium', 'icon': '🍇', 'season': 'Annual'},
    'Watermelon': {'N': (85, 115), 'P': (15, 30), 'K': (45, 60), 'temp': (24, 38), 'humidity': (50, 75), 'ph': (6.0, 7.0), 'rainfall': (300, 600), 'water_req': 'Medium', 'icon': '🍉', 'season': 'Zaid (Summer)'},
    'Muskmelon': {'N': (85, 115), 'P': (15, 30), 'K': (45, 60), 'temp': (25, 35), 'humidity': (85, 95), 'ph': (6.0, 7.0), 'rainfall': (300, 600), 'water_req': 'Medium', 'icon': '🍈', 'season': 'Zaid (Summer)'},
    'Apple': {'N': (15, 35), 'P': (120, 145), 'K': (190, 210), 'temp': (10, 22), 'humidity': (70, 90), 'ph': (5.5, 6.5), 'rainfall': (900, 1500), 'water_req': 'Moderate', 'icon': '🍏', 'season': 'Annual'},
    'Orange': {'N': (15, 35), 'P': (10, 25), 'K': (5, 20), 'temp': (15, 35), 'humidity': (75, 95), 'ph': (6.0, 7.5), 'rainfall': (800, 1400), 'water_req': 'Medium', 'icon': '🍊', 'season': 'Annual'},
    'Papaya': {'N': (40, 60), 'P': (55, 70), 'K': (45, 60), 'temp': (22, 36), 'humidity': (80, 95), 'ph': (6.0, 7.0), 'rainfall': (1000, 2000), 'water_req': 'High', 'icon': '🍈', 'season': 'Annual'},
    'Coconut': {'N': (15, 35), 'P': (10, 25), 'K': (25, 40), 'temp': (25, 35), 'humidity': (90, 99), 'ph': (5.5, 6.5), 'rainfall': (1300, 2400), 'water_req': 'High', 'icon': '🥥', 'season': 'Perennial'},
    'Cotton': {'N': (110, 135), 'P': (40, 60), 'K': (15, 30), 'temp': (22, 35), 'humidity': (55, 75), 'ph': (6.0, 8.0), 'rainfall': (600, 1100), 'water_req': 'Medium', 'icon': '🌱', 'season': 'Kharif'},
    'Jute': {'N': (70, 95), 'P': (40, 55), 'K': (35, 50), 'temp': (24, 35), 'humidity': (70, 90), 'ph': (6.0, 7.5), 'rainfall': (1200, 2000), 'water_req': 'Very High', 'icon': '🌿', 'season': 'Kharif'},
    'Coffee': {'N': (90, 115), 'P': (25, 40), 'K': (25, 40), 'temp': (20, 28), 'humidity': (65, 80), 'ph': (6.0, 6.8), 'rainfall': (1400, 2200), 'water_req': 'High', 'icon': '☕', 'season': 'Perennial'},
    'Tomato': {'N': (90, 120), 'P': (50, 70), 'K': (70, 95), 'temp': (18, 30), 'humidity': (60, 75), 'ph': (6.0, 6.8), 'rainfall': (400, 700), 'water_req': 'Medium', 'icon': '🍅', 'season': 'Multi-season'},
    'Potato': {'N': (100, 130), 'P': (60, 80), 'K': (100, 130), 'temp': (15, 24), 'humidity': (65, 85), 'ph': (5.2, 6.5), 'rainfall': (400, 650), 'water_req': 'Medium', 'icon': '🥔', 'season': 'Rabi'},
    'Sugarcane': {'N': (130, 160), 'P': (50, 70), 'K': (80, 110), 'temp': (20, 38), 'humidity': (70, 85), 'ph': (6.5, 7.8), 'rainfall': (1200, 2000), 'water_req': 'Very High', 'icon': '🎋', 'season': 'Perennial'},
    'Soybean': {'N': (25, 45), 'P': (50, 70), 'K': (35, 50), 'temp': (20, 32), 'humidity': (60, 75), 'ph': (6.0, 7.0), 'rainfall': (600, 950), 'water_req': 'Medium', 'icon': '🫛', 'season': 'Kharif'}
}

def generate_training_data(samples_per_crop=100):
    """Generates synthetic training dataset based on agronomic bounds."""
    data = []
    np.random.seed(42)
    
    for crop, bounds in CROP_PROFILES.items():
        n_vals = np.random.uniform(bounds['N'][0] * 0.85, bounds['N'][1] * 1.15, samples_per_crop)
        p_vals = np.random.uniform(bounds['P'][0] * 0.85, bounds['P'][1] * 1.15, samples_per_crop)
        k_vals = np.random.uniform(bounds['K'][0] * 0.85, bounds['K'][1] * 1.15, samples_per_crop)
        t_vals = np.random.uniform(bounds['temp'][0] - 2, bounds['temp'][1] + 2, samples_per_crop)
        h_vals = np.clip(np.random.uniform(bounds['humidity'][0] - 5, bounds['humidity'][1] + 5, samples_per_crop), 10, 100)
        ph_vals = np.clip(np.random.uniform(bounds['ph'][0] - 0.3, bounds['ph'][1] + 0.3, samples_per_crop), 4.0, 9.5)
        rf_vals = np.clip(np.random.uniform(bounds['rainfall'][0] * 0.8, bounds['rainfall'][1] * 1.2, samples_per_crop), 150, 3500)
        
        for i in range(samples_per_crop):
            data.append({
                'N': n_vals[i],
                'P': p_vals[i],
                'K': k_vals[i],
                'temperature': t_vals[i],
                'humidity': h_vals[i],
                'ph': ph_vals[i],
                'rainfall': rf_vals[i],
                'crop': crop
            })
    return pd.DataFrame(data)

def train_and_save_model():
    """Trains a Random Forest classifier pipeline and saves it."""
    df = generate_training_data(samples_per_crop=120)
    X = df[['N', 'P', 'K', 'temperature', 'humidity', 'ph', 'rainfall']]
    y = df['crop']

    pipeline = Pipeline([
        ('scaler', StandardScaler()),
        ('classifier', RandomForestClassifier(n_estimators=100, random_state=42, max_depth=16))
    ])
    pipeline.fit(X, y)
    joblib.dump(pipeline, MODEL_PATH)
    return pipeline

def get_model():
    """Loads existing model or trains new one if not found."""
    if os.path.exists(MODEL_PATH):
        try:
            return joblib.load(MODEL_PATH)
        except Exception:
            pass
    return train_and_save_model()

# Global model instance
model_pipeline = None

def init_ml():
    global model_pipeline
    model_pipeline = get_model()

def calculate_heuristic_match(crop_name, n, p, k, temp, humidity, ph, rainfall):
    """Fallback distance-based agronomic suitability score (0-100%)."""
    if crop_name not in CROP_PROFILES:
        return 70.0
    p_info = CROP_PROFILES[crop_name]

    def score_param(val, min_v, max_v, weight=1.0):
        if min_v <= val <= max_v:
            return 100.0 * weight
        dist = min(abs(val - min_v), abs(val - max_v))
        span = max_v - min_v or 1.0
        penalty = min(dist / span * 50.0, 80.0)
        return max(20.0, 100.0 - penalty) * weight

    s_n = score_param(n, p_info['N'][0], p_info['N'][1], 1.2)
    s_p = score_param(p, p_info['P'][0], p_info['P'][1], 1.0)
    s_k = score_param(k, p_info['K'][0], p_info['K'][1], 1.0)
    s_temp = score_param(temp, p_info['temp'][0], p_info['temp'][1], 1.1)
    s_hum = score_param(humidity, p_info['humidity'][0], p_info['humidity'][1], 0.8)
    s_ph = score_param(ph, p_info['ph'][0], p_info['ph'][1], 1.3)
    s_rf = score_param(rainfall, p_info['rainfall'][0], p_info['rainfall'][1], 0.9)

    total_weight = 1.2 + 1.0 + 1.0 + 1.1 + 0.8 + 1.3 + 0.9
    raw_score = (s_n + s_p + s_k + s_temp + s_hum + s_ph + s_rf) / total_weight
    return round(float(raw_score), 1)

def predict_crop(n, p, k, temperature=26.0, humidity=65.0, ph=6.5, rainfall=750.0, top_k=3):
    """Predicts best matching crops with probabilities and agronomic rationale."""
    global model_pipeline
    if model_pipeline is None:
        try:
            model_pipeline = get_model()
        except Exception:
            model_pipeline = None

    features = pd.DataFrame([{
        'N': n, 'P': p, 'K': k,
        'temperature': temperature, 'humidity': humidity,
        'ph': ph, 'rainfall': rainfall
    }])

    results = []
    if model_pipeline is not None:
        try:
            classes = model_pipeline.classes_
            probs = model_pipeline.predict_proba(features)[0]
            top_indices = np.argsort(probs)[::-1][:top_k]

            for idx in top_indices:
                crop_name = classes[idx]
                ml_prob = round(float(probs[idx] * 100), 1)
                heuristic = calculate_heuristic_match(crop_name, n, p, k, temperature, humidity, ph, rainfall)
                
                # Combine ML probability and agronomic heuristic for robust scoring
                combined_score = round(max(ml_prob * 0.6 + heuristic * 0.4, 45.0), 1)
                profile = CROP_PROFILES.get(crop_name, {})
                results.append({
                    'crop_name': crop_name,
                    'confidence_score': combined_score,
                    'icon': profile.get('icon', '🌾'),
                    'season': profile.get('season', 'Kharif / Rabi'),
                    'water_requirement': profile.get('water_req', 'Medium'),
                    'ideal_n': profile.get('N', (60, 90)),
                    'ideal_p': profile.get('P', (30, 60)),
                    'ideal_k': profile.get('K', (30, 60)),
                    'ideal_ph': profile.get('ph', (6.0, 7.5)),
                    'suitability_notes': generate_crop_notes(crop_name, n, p, k, ph)
                })
        except Exception as e:
            results = []

    if not results:
        # Fallback to pure agronomic heuristic
        all_scored = []
        for crop_name, profile in CROP_PROFILES.items():
            score = calculate_heuristic_match(crop_name, n, p, k, temperature, humidity, ph, rainfall)
            all_scored.append((score, crop_name, profile))
        all_scored.sort(key=lambda x: x[0], reverse=True)

        for score, crop_name, profile in all_scored[:top_k]:
            results.append({
                'crop_name': crop_name,
                'confidence_score': score,
                'icon': profile.get('icon', '🌾'),
                'season': profile.get('season', 'General'),
                'water_requirement': profile.get('water_req', 'Medium'),
                'ideal_n': profile.get('N', (60, 90)),
                'ideal_p': profile.get('P', (30, 60)),
                'ideal_k': profile.get('K', (30, 60)),
                'ideal_ph': profile.get('ph', (6.0, 7.5)),
                'suitability_notes': generate_crop_notes(crop_name, n, p, k, ph)
            })

    return results

def generate_crop_notes(crop_name, n, p, k, ph):
    """Generates human-readable advice for the crop based on current soil."""
    profile = CROP_PROFILES.get(crop_name, {})
    notes = []
    if not profile:
        return "Well suited for current agro-climatic conditions."

    if ph < profile['ph'][0]:
        notes.append(f"Soil pH ({ph}) is more acidic than preferred ({profile['ph'][0]}-{profile['ph'][1]}). Apply agricultural lime.")
    elif ph > profile['ph'][1]:
        notes.append(f"Soil pH ({ph}) is alkaline. Incorporate organic mulch or gypsum.")
    else:
        notes.append(f"Soil pH ({ph}) is within the optimum zone ({profile['ph'][0]}-{profile['ph'][1]}).")

    if n < profile['N'][0]:
        notes.append(f"Nitrogen is below optimum ({profile['N'][0]}-{profile['N'][1]} mg/kg). Top-dress with compost or Urea.")
    elif n > profile['N'][1]:
        notes.append(f"Nitrogen level is high. Reduce nitrogenous fertilizers to avoid vegetative overgrowth.")

    return " ".join(notes)

def evaluate_soil_health(ph, n, p, k, moisture, organic_matter=2.5):
    """
    Evaluates comprehensive soil health parameters.
    Returns score (0-100), ratings, and specific soil amendment tips.
    """
    analysis = {}
    recommendations = []
    penalties = 0

    # pH Evaluation
    if ph < 5.5:
        analysis['ph'] = {'status': 'Strongly Acidic', 'level': 'Critical Low', 'color': 'red', 'value': ph}
        recommendations.append("Apply Agricultural Limestone (Calcitic or Dolomitic lime) at 2-3 tons/ha to neutralize soil acidity.")
        penalties += 20
    elif 5.5 <= ph < 6.2:
        analysis['ph'] = {'status': 'Slightly Acidic', 'level': 'Moderate Low', 'color': 'amber', 'value': ph}
        recommendations.append("Consider moderate lime application or wood ash to raise pH toward neutral 6.5.")
        penalties += 8
    elif 6.2 <= ph <= 7.5:
        analysis['ph'] = {'status': 'Optimal Neutral', 'level': 'Optimal', 'color': 'green', 'value': ph}
        penalties += 0
    elif 7.5 < ph <= 8.5:
        analysis['ph'] = {'status': 'Moderately Alkaline', 'level': 'Moderate High', 'color': 'amber', 'value': ph}
        recommendations.append("Incorporate elemental sulfur or gypsum and green manure to reduce alkalinity.")
        penalties += 8
    else:
        analysis['ph'] = {'status': 'Strongly Alkaline', 'level': 'Critical High', 'color': 'red', 'value': ph}
        recommendations.append("Urgent soil amendment required: Apply Gypsum (calcium sulfate) and heavy organic matter.")
        penalties += 25

    # Nitrogen (N) Evaluation (mg/kg)
    if n < 40:
        analysis['nitrogen'] = {'status': 'Deficient', 'level': 'Low', 'color': 'red', 'value': n}
        recommendations.append("Nitrogen deficient: Apply decomposed Farmyard Manure (FYM), Neem-coated Urea, or sow legume cover crops.")
        penalties += 15
    elif 40 <= n <= 100:
        analysis['nitrogen'] = {'status': 'Adequate / Balanced', 'level': 'Optimal', 'color': 'green', 'value': n}
    else:
        analysis['nitrogen'] = {'status': 'Excess / High', 'level': 'High', 'color': 'amber', 'value': n}
        recommendations.append("High nitrogen detected: Avoid excess urea to prevent lodging and pest susceptibility.")
        penalties += 5

    # Phosphorus (P) Evaluation (mg/kg)
    if p < 25:
        analysis['phosphorus'] = {'status': 'Deficient', 'level': 'Low', 'color': 'red', 'value': p}
        recommendations.append("Phosphorus deficient: Apply Single Super Phosphate (SSP) or Di-Ammonium Phosphate (DAP) at root depth.")
        penalties += 12
    elif 25 <= p <= 65:
        analysis['phosphorus'] = {'status': 'Adequate / Balanced', 'level': 'Optimal', 'color': 'green', 'value': p}
    else:
        analysis['phosphorus'] = {'status': 'High', 'level': 'High', 'color': 'amber', 'value': p}
        penalties += 4

    # Potassium (K) Evaluation (mg/kg)
    if k < 25:
        analysis['potassium'] = {'status': 'Deficient', 'level': 'Low', 'color': 'red', 'value': k}
        recommendations.append("Potassium deficient: Apply Muriate of Potash (MOP) or Sulfate of Potash (SOP) to boost disease resistance.")
        penalties += 12
    elif 25 <= k <= 80:
        analysis['potassium'] = {'status': 'Adequate / Balanced', 'level': 'Optimal', 'color': 'green', 'value': k}
    else:
        analysis['potassium'] = {'status': 'High', 'level': 'High', 'color': 'amber', 'value': k}
        penalties += 4

    # Moisture Evaluation (%)
    if moisture < 30:
        analysis['moisture'] = {'status': 'Severe Water Stress', 'level': 'Dry', 'color': 'red', 'value': moisture}
        recommendations.append("Soil moisture is severely low (<30%). Immediate irrigation cycle recommended.")
        penalties += 18
    elif 30 <= moisture < 50:
        analysis['moisture'] = {'status': 'Moderate Moisture', 'level': 'Adequate', 'color': 'amber', 'value': moisture}
    elif 50 <= moisture <= 75:
        analysis['moisture'] = {'status': 'Optimal Field Capacity', 'level': 'Optimal', 'color': 'green', 'value': moisture}
    else:
        analysis['moisture'] = {'status': 'Waterlogged / Saturated', 'level': 'High', 'color': 'blue', 'value': moisture}
        recommendations.append("Soil is saturated (>75% moisture). Ensure active field drainage to prevent root rot.")
        penalties += 12

    # Organic Matter (%)
    analysis['organic_matter'] = {
        'value': organic_matter,
        'status': 'Optimal' if organic_matter >= 2.0 else 'Low',
        'color': 'green' if organic_matter >= 2.0 else 'amber'
    }
    if organic_matter < 2.0:
        recommendations.append("Low organic carbon: Add 5-8 tons/ha of Vermicompost or biochar to enhance microbial activity.")
        penalties += 10

    health_score = max(20.0, min(100.0, 100.0 - penalties))
    if not recommendations:
        recommendations.append("Soil is in excellent prime health. Maintain current crop rotation and organic mulch practices.")

    return {
        'score': round(health_score, 1),
        'analysis': analysis,
        'recommendations': recommendations
    }
