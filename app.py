import os
import sys
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
from flask import Flask, render_template, request, jsonify, session
from flask_cors import CORS
from models import db, Farmer, SoilData, Crop, Recommendation, seed_database
from ml_engine import predict_crop, evaluate_soil_health, init_ml
from irrigation_engine import calculate_irrigation
from weather_service import get_weather_data
from google import genai

# Initialize Gemini AI client for AgroBot chat
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', 'AQ.Ab8RN6Lre3z7UUGK6uGacXD_9Z_6dVazqDXwNkVq5DfG4VS6aQ')
gemini_client = genai.Client(api_key=GEMINI_API_KEY)

AGROBOT_SYSTEM_PROMPT = """You are AgroBot, an expert AI precision agronomist and agricultural advisor embedded in the AgroPulse Smart Agriculture System. Your role is to help farmers with:

- Crop selection and management advice
- Soil health analysis and amendment recommendations (NPK, pH, organic matter)
- Smart irrigation scheduling and water management
- Pest and disease identification, prevention, and treatment (both organic and chemical)
- Fertilizer recommendations and application timing
- Yield optimization and ROI calculations
- Weather-based farming decisions
- Sustainable and precision agriculture practices

Guidelines:
- Give practical, actionable advice specific to Indian agriculture when relevant
- Use emojis sparingly for readability (🌱💧🌾📈🧪)
- Format key points with **bold** text for emphasis
- Keep responses concise but informative (2-4 paragraphs max)
- Mention specific product names, dosages, and application methods when applicable
- If you don't know something, say so honestly rather than guessing
- Always prioritize farmer safety when recommending chemicals (mention PPE)
- You can discuss general topics too, but steer conversations back to agriculture when appropriate
"""

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'smart-agri-secret-key-2026-secure')
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///smart_agriculture.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

CORS(app)
db.init_app(app)

# Initialize ML model & DB tables on startup
with app.app_context():
    db.create_all()
    seed_database()
    init_ml()

def get_current_farmer():
    """Helper to retrieve current authenticated farmer or default demo farmer."""
    farmer_id = session.get('farmer_id')
    if farmer_id:
        farmer = db.session.get(Farmer, farmer_id)
        if farmer:
            return farmer
    # Default to first farmer if session not active
    return Farmer.query.first()

# =========================================================================
# WEB PAGES
# =========================================================================

@app.route('/')
def index():
    return render_template('index.html')

# =========================================================================
# AUTHENTICATION API
# =========================================================================

@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not name or not email or not password:
        return jsonify({'error': 'Name, email, and password are required'}), 400

    if Farmer.query.filter_by(email=email).first():
        return jsonify({'error': 'An account with this email already exists'}), 409

    farmer = Farmer(
        name=name,
        email=email,
        phone=data.get('phone', ''),
        location=data.get('location', 'Nagpur, India'),
        farm_size_acres=float(data.get('farm_size_acres', 5.0)),
        soil_type=data.get('soil_type', 'Loamy'),
        primary_crop=data.get('primary_crop', 'Wheat')
    )
    farmer.set_password(password)
    db.session.add(farmer)
    db.session.commit()

    session['farmer_id'] = farmer.farmer_id
    return jsonify({'message': 'Registration successful', 'farmer': farmer.to_dict()}), 201

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400

    farmer = Farmer.query.filter_by(email=email).first()
    if not farmer or not farmer.check_password(password):
        return jsonify({'error': 'Invalid email or password'}), 401

    session['farmer_id'] = farmer.farmer_id
    return jsonify({'message': 'Login successful', 'farmer': farmer.to_dict()})

@app.route('/api/auth/logout', methods=['POST'])
def logout():
    session.pop('farmer_id', None)
    return jsonify({'message': 'Logged out successfully'})

@app.route('/api/auth/me', methods=['GET'])
def get_me():
    farmer = get_current_farmer()
    if not farmer:
        return jsonify({'authenticated': False, 'farmer': None})
    return jsonify({'authenticated': True, 'farmer': farmer.to_dict()})

@app.route('/api/auth/profile', methods=['PUT'])
def update_profile():
    farmer = get_current_farmer()
    if not farmer:
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.get_json() or {}
    if 'name' in data:
        farmer.name = data['name']
    if 'phone' in data:
        farmer.phone = data['phone']
    if 'location' in data:
        farmer.location = data['location']
    if 'farm_size_acres' in data:
        try:
            farmer.farm_size_acres = float(data['farm_size_acres'])
        except (ValueError, TypeError):
            pass
    if 'soil_type' in data:
        farmer.soil_type = data['soil_type']
    if 'primary_crop' in data:
        farmer.primary_crop = data['primary_crop']

    db.session.commit()
    return jsonify({'message': 'Profile updated successfully', 'farmer': farmer.to_dict()})

# =========================================================================
# SOIL DATA & HEALTH API
# =========================================================================

@app.route('/api/soil', methods=['GET', 'POST'])
def handle_soil():
    farmer = get_current_farmer()
    if not farmer:
        return jsonify({'error': 'Farmer record not found'}), 404

    if request.method == 'POST':
        data = request.get_json() or {}
        try:
            ph = float(data.get('ph', 6.5))
            n = float(data.get('nitrogen', 80.0))
            p = float(data.get('phosphorus', 45.0))
            k = float(data.get('potassium', 40.0))
            moisture = float(data.get('moisture', 55.0))
            org_matter = float(data.get('organic_matter', 2.5))
            notes = data.get('notes', 'Field soil test sample')

            soil_record = SoilData(
                farmer_id=farmer.farmer_id,
                ph=ph,
                nitrogen=n,
                phosphorus=p,
                potassium=k,
                moisture=moisture,
                organic_matter=org_matter,
                notes=notes
            )
            db.session.add(soil_record)
            db.session.commit()

            # Evaluate health
            health_report = evaluate_soil_health(ph, n, p, k, moisture, org_matter)

            return jsonify({
                'message': 'Soil test record saved successfully',
                'soil_record': soil_record.to_dict(),
                'health_report': health_report
            }), 201

        except Exception as e:
            return jsonify({'error': f'Failed to process soil data: {str(e)}'}), 400

    # GET: Return latest soil test
    latest_soil = SoilData.query.filter_by(farmer_id=farmer.farmer_id).order_by(SoilData.test_date.desc()).first()
    if not latest_soil:
        # Return sensible baseline defaults
        return jsonify({
            'soil_record': {
                'ph': 6.5, 'nitrogen': 80.0, 'phosphorus': 45.0, 'potassium': 40.0,
                'moisture': 55.0, 'organic_matter': 2.5, 'notes': 'Default baseline'
            },
            'health_report': evaluate_soil_health(6.5, 80.0, 45.0, 40.0, 55.0)
        })

    health_report = evaluate_soil_health(
        latest_soil.ph, latest_soil.nitrogen, latest_soil.phosphorus,
        latest_soil.potassium, latest_soil.moisture, latest_soil.organic_matter or 2.5
    )
    return jsonify({
        'soil_record': latest_soil.to_dict(),
        'health_report': health_report
    })

# =========================================================================
# CROP RECOMMENDATION API (ML + Heuristics)
# =========================================================================

@app.route('/api/recommend-crop', methods=['POST'])
def recommend_crop():
    farmer = get_current_farmer()
    data = request.get_json() or {}

    try:
        n = float(data.get('nitrogen', 80.0))
        p = float(data.get('phosphorus', 45.0))
        k = float(data.get('potassium', 40.0))
        ph = float(data.get('ph', 6.5))
        moisture = float(data.get('moisture', 55.0))
        temperature = float(data.get('temperature', 26.0))
        humidity = float(data.get('humidity', 65.0))
        rainfall = float(data.get('rainfall', 750.0))
        save_history = data.get('save_to_history', True)

        # ML Prediction
        recommended_crops = predict_crop(n, p, k, temperature, humidity, ph, rainfall, top_k=4)

        # Soil health
        soil_eval = evaluate_soil_health(ph, n, p, k, moisture)

        top_crop = recommended_crops[0] if recommended_crops else {'crop_name': 'Wheat', 'confidence_score': 85.0}

        # Irrigation advice for top crop
        irrigation_plan = calculate_irrigation(
            moisture_pct=moisture,
            crop_name=top_crop['crop_name'],
            temperature=temperature,
            humidity=humidity,
            forecast_rain_mm=float(data.get('forecast_rain_mm', 0.0)),
            farm_size_acres=farmer.farm_size_acres if farmer else 5.0,
            soil_type=farmer.soil_type if farmer else 'Loamy'
        )

        # Save to Recommendation DB history if requested
        if save_history and farmer:
            alt_names = [f"{c['crop_name']} ({c['confidence_score']}%)" for c in recommended_crops[1:]]
            rec_record = Recommendation(
                farmer_id=farmer.farmer_id,
                crop=top_crop['crop_name'],
                confidence_score=top_crop['confidence_score'],
                irrigation=irrigation_plan['action_summary'],
                soil_health_score=soil_eval['score'],
                recommended_fertilizers=top_crop.get('suitability_notes', ''),
                top_alternatives=", ".join(alt_names),
                notes=f"Soil: N={n}, P={p}, K={k}, pH={ph}, Moisture={moisture}%"
            )
            db.session.add(rec_record)
            db.session.commit()

        return jsonify({
            'success': True,
            'top_recommendation': top_crop,
            'all_recommendations': recommended_crops,
            'soil_health': soil_eval,
            'irrigation_plan': irrigation_plan
        })

    except Exception as e:
        return jsonify({'error': f'Recommendation failed: {str(e)}'}), 400

# =========================================================================
# WEATHER API
# =========================================================================

@app.route('/api/weather', methods=['GET'])
def get_weather():
    farmer = get_current_farmer()
    lat = request.args.get('lat', type=float)
    lon = request.args.get('lon', type=float)
    city = request.args.get('city', type=str)

    if lat is None and lon is None and not city:
        if farmer:
            lat, lon = farmer.latitude or 21.1458, farmer.longitude or 79.0882
            city = farmer.location
        else:
            lat, lon = 21.1458, 79.0882

    weather_data = get_weather_data(lat=lat or 21.1458, lon=lon or 79.0882, city_name=city)
    return jsonify(weather_data)

# =========================================================================
# SMART IRRIGATION API
# =========================================================================

@app.route('/api/irrigation', methods=['GET', 'POST'])
def get_irrigation():
    farmer = get_current_farmer()
    
    if request.method == 'POST':
        data = request.get_json() or {}
    else:
        data = request.args.to_dict()

    moisture = float(data.get('moisture', 50.0))
    crop_name = data.get('crop_name', farmer.primary_crop if farmer else 'Wheat')
    temp = float(data.get('temperature', 28.0))
    humidity = float(data.get('humidity', 60.0))
    rain_mm = float(data.get('forecast_rain_mm', 0.0))
    rain_prob = float(data.get('rain_prob', 0))
    farm_size = float(data.get('farm_size_acres', farmer.farm_size_acres if farmer else 5.0))
    soil_type = data.get('soil_type', farmer.soil_type if farmer else 'Loamy')

    result = calculate_irrigation(
        moisture_pct=moisture,
        crop_name=crop_name,
        temperature=temp,
        humidity=humidity,
        forecast_rain_mm=rain_mm,
        rain_prob=rain_prob,
        farm_size_acres=farm_size,
        soil_type=soil_type
    )
    return jsonify(result)

# =========================================================================
# HISTORY & ANALYTICS API
# =========================================================================

@app.route('/api/history', methods=['GET'])
def get_history():
    farmer = get_current_farmer()
    if not farmer:
        return jsonify({'soil_history': [], 'recommendation_history': []})

    soil_records = SoilData.query.filter_by(farmer_id=farmer.farmer_id).order_by(SoilData.test_date.desc()).limit(20).all()
    rec_records = Recommendation.query.filter_by(farmer_id=farmer.farmer_id).order_by(Recommendation.date.desc()).limit(20).all()

    return jsonify({
        'soil_history': [s.to_dict() for s in soil_records],
        'recommendation_history': [r.to_dict() for r in rec_records]
    })

@app.route('/api/history/soil/<int:soil_id>', methods=['DELETE'])
def delete_soil_record(soil_id):
    farmer = get_current_farmer()
    record = SoilData.query.filter_by(soil_id=soil_id, farmer_id=farmer.farmer_id).first()
    if not record:
        return jsonify({'error': 'Record not found'}), 404
    db.session.delete(record)
    db.session.commit()
    return jsonify({'message': 'Record deleted successfully'})

@app.route('/api/history/recommendation/<int:rec_id>', methods=['DELETE'])
def delete_recommendation_record(rec_id):
    farmer = get_current_farmer()
    record = Recommendation.query.filter_by(recommendation_id=rec_id, farmer_id=farmer.farmer_id).first()
    if not record:
        return jsonify({'error': 'Record not found'}), 404
    db.session.delete(record)
    db.session.commit()
    return jsonify({'message': 'Record deleted successfully'})

# =========================================================================
# CROPS DIRECTORY & DASHBOARD STATS
# =========================================================================

@app.route('/api/crops', methods=['GET'])
def get_crops():
    crops = Crop.query.all()
    return jsonify([c.to_dict() for c in crops])

@app.route('/api/dashboard-summary', methods=['GET'])
def get_dashboard_summary():
    farmer = get_current_farmer()
    if not farmer:
        return jsonify({'error': 'No active farmer profile'}), 404

    latest_soil = SoilData.query.filter_by(farmer_id=farmer.farmer_id).order_by(SoilData.test_date.desc()).first()
    latest_rec = Recommendation.query.filter_by(farmer_id=farmer.farmer_id).order_by(Recommendation.date.desc()).first()
    total_soil_tests = SoilData.query.filter_by(farmer_id=farmer.farmer_id).count()
    total_recommendations = Recommendation.query.filter_by(farmer_id=farmer.farmer_id).count()

    current_soil_dict = latest_soil.to_dict() if latest_soil else {
        'ph': 6.8, 'nitrogen': 85.0, 'phosphorus': 48.0, 'potassium': 52.0, 'moisture': 58.0, 'organic_matter': 2.8
    }
    health_eval = evaluate_soil_health(
        current_soil_dict['ph'], current_soil_dict['nitrogen'],
        current_soil_dict['phosphorus'], current_soil_dict['potassium'],
        current_soil_dict['moisture'], current_soil_dict.get('organic_matter', 2.5)
    )

    irrigation_summary = calculate_irrigation(
        moisture_pct=current_soil_dict['moisture'],
        crop_name=farmer.primary_crop or 'Wheat',
        farm_size_acres=farmer.farm_size_acres,
        soil_type=farmer.soil_type
    )

    return jsonify({
        'farmer': farmer.to_dict(),
        'soil_health_score': health_eval['score'],
        'latest_soil': current_soil_dict,
        'latest_recommendation': latest_rec.to_dict() if latest_rec else None,
        'irrigation_summary': irrigation_summary,
        'total_soil_tests': total_soil_tests,
        'total_recommendations': total_recommendations
    })

# =========================================================================
# MULTI-FIELD GIS PLOTS API
# =========================================================================

# Simulated live state for farm plots
FARM_PLOTS = [
    {
        'id': 'plot-a',
        'name': 'Plot A — North Acre',
        'crop': 'Cotton (Bt-II)',
        'acres': 4.5,
        'soil_type': 'Black Clay Loam',
        'moisture': 58,
        'ph': 6.8,
        'ndvi': 0.76,
        'health_status': 'Optimal',
        'valve_status': 'IDLE',
        'valve_last_run': 'Today, 05:30 AM',
        'polygon': [
            [21.1470, 79.0860],
            [21.1495, 79.0865],
            [21.1490, 79.0910],
            [21.1465, 79.0905]
        ]
    },
    {
        'id': 'plot-b',
        'name': 'Plot B — Riverbed Field',
        'crop': 'Wheat (Sharbati)',
        'acres': 3.0,
        'soil_type': 'Alluvial Loam',
        'moisture': 42,
        'ph': 7.1,
        'ndvi': 0.62,
        'health_status': 'Needs Irrigation',
        'valve_status': 'RUNNING',
        'valve_last_run': 'Active (15m remaining)',
        'polygon': [
            [21.1440, 79.0880],
            [21.1460, 79.0885],
            [21.1455, 79.0930],
            [21.1435, 79.0925]
        ]
    },
    {
        'id': 'plot-c',
        'name': 'Plot C — Greenhouse 01',
        'crop': 'Hydroponic Tomatoes',
        'acres': 1.0,
        'soil_type': 'Coco Peat / Perlite',
        'moisture': 72,
        'ph': 6.4,
        'ndvi': 0.88,
        'health_status': 'Thriving',
        'valve_status': 'AUTO-TIMED',
        'valve_last_run': 'Scheduled 14:00',
        'polygon': [
            [21.1480, 79.0920],
            [21.1500, 79.0925],
            [21.1498, 79.0950],
            [21.1478, 79.0945]
        ]
    }
]

@app.route('/api/plots', methods=['GET'])
def get_plots():
    return jsonify({'plots': FARM_PLOTS})

@app.route('/api/plots/<plot_id>/valve', methods=['POST'])
def toggle_plot_valve(plot_id):
    data = request.get_json() or {}
    action = data.get('action', 'toggle') # 'start' | 'stop' | 'toggle'
    
    for plot in FARM_PLOTS:
        if plot['id'] == plot_id:
            if action == 'start' or (action == 'toggle' and plot['valve_status'] != 'RUNNING'):
                plot['valve_status'] = 'RUNNING'
                plot['valve_last_run'] = 'Active (Manual Override 30m)'
            else:
                plot['valve_status'] = 'IDLE'
                plot['valve_last_run'] = 'Stopped manually just now'
            return jsonify({'success': True, 'plot': plot})
            
    return jsonify({'error': 'Plot not found'}), 404

# =========================================================================
# AI PLANT DISEASE & PEST DIAGNOSTIC SCANNER
# =========================================================================

DISEASE_DB = {
    'cotton_curl': {
        'name': 'Cotton Leaf Curl Virus (CLCuV)',
        'crop': 'Cotton',
        'confidence': 96.4,
        'severity': 'Moderate - High Risk',
        'symptoms': 'Upward leaf curling, thickened veins, enation on underside of leaves, stunted floral growth.',
        'organic_treatment': 'Foliar spray of 5% Neem seed kernel extract (NSKE) + yellow sticky traps for whiteflies vector.',
        'chemical_treatment': 'Apply Imidacloprid 17.8% SL @ 0.3ml/L or Diafenthiuron 50% WP @ 1g/L to eliminate vector populations.',
        'prevention': 'Eradicate alternative weed hosts (Abutilon indicum) near bunds and maintain proper plant spacing.'
    },
    'wheat_rust': {
        'name': 'Stripe / Yellow Rust (Puccinia striiformis)',
        'crop': 'Wheat',
        'confidence': 94.8,
        'severity': 'High Severity',
        'symptoms': 'Bright yellow-orange pustules arranged in linear stripes along the leaf veins; powdery yellow spore release.',
        'organic_treatment': 'Trichoderma viride bio-fungicide foliar spray @ 5g/L; avoid excess late nitrogen fertilization.',
        'chemical_treatment': 'Spray Propiconazole 25% EC (Tilt) @ 1.0ml/L or Tebuconazole 25.9% EC @ 1.25ml/L at first appearance.',
        'prevention': 'Use rust-resistant wheat cultivars (e.g., HD-3086, DBW-187) and timely autumn sowing.'
    },
    'tomato_blight': {
        'name': 'Early Blight (Alternaria solani)',
        'crop': 'Tomato',
        'confidence': 98.1,
        'severity': 'Moderate',
        'symptoms': 'Concentric brown-to-black target ring lesions on older leaves, surrounded by yellow halos; leaf drop.',
        'organic_treatment': 'Copper oxychloride or Bordeaux mixture (1%) spray combined with Bacillus subtilis bio-agent.',
        'chemical_treatment': 'Mancozeb 75% WP @ 2.5g/L or Chlorothalonil 75% WP @ 2g/L alternately every 10-12 days.',
        'prevention': 'Avoid overhead sprinkler watering; prune lower canopy foliage; apply mulch to block soil splash.'
    },
    'rice_blast': {
        'name': 'Rice Blast (Magnaporthe oryzae)',
        'crop': 'Rice (Paddy)',
        'confidence': 95.3,
        'severity': 'Severe',
        'symptoms': 'Spindle-shaped lesions with grayish centers and dark brown margins on leaf blades; neck node rotting.',
        'organic_treatment': 'Pseudomonas fluorescens seed treatment (10g/kg) and foliar spray (2.5kg/ha).',
        'chemical_treatment': 'Tricyclazole 75% WP @ 0.6g/L or Isoprothiolane 40% EC @ 1.5ml/L at boot leaf stage.',
        'prevention': 'Balanced nitrogen application split into 3 doses; avoid standing cold floodwater.'
    },
    'healthy_leaf': {
        'name': 'Healthy Foliage — No Pathogen Detected',
        'crop': 'Multiple Crops',
        'confidence': 99.2,
        'severity': 'Optimal (Healthy)',
        'symptoms': 'Vibrant chlorophyll density, uniform vein structure, no active necrotic or chlorotic lesions.',
        'organic_treatment': 'Maintain routine preventative botanical sprays (Panchagavya or seaweed extract @ 3ml/L).',
        'chemical_treatment': 'No chemical fungicide required. Maintain soil nutrient balance.',
        'prevention': 'Continue standard scouting and preserve beneficial predatory insects.'
    }
}

@app.route('/api/disease-diagnostic', methods=['POST'])
def diagnose_disease():
    data = request.get_json() or {}
    sample_id = data.get('sample_id', 'cotton_curl')
    crop_filter = data.get('crop', '')

    if sample_id in DISEASE_DB:
        diagnosis = DISEASE_DB[sample_id]
    else:
        # Fallback to healthy or first match
        diagnosis = DISEASE_DB['healthy_leaf']

    return jsonify({
        'success': True,
        'diagnosis': diagnosis
    })

# =========================================================================
# AGROBOT AI CONVERSATIONAL ASSISTANT (Powered by Google Gemini)
# =========================================================================

@app.route('/api/agrobot/chat', methods=['POST'])
def agrobot_chat():
    data = request.get_json() or {}
    msg = data.get('message', '').strip()

    if not msg:
        return jsonify({'reply': "Hello! I am AgroBot, your AI precision agronomist powered by Google Gemini. How can I help you today with crops, soil nutrition, irrigation, or pest control?"})

    try:
        response = gemini_client.models.generate_content(
            model='gemini-3.5-flash',
            contents=msg,
            config={
                'system_instruction': AGROBOT_SYSTEM_PROMPT,
                'temperature': 0.7,
                'max_output_tokens': 1024,
            }
        )
        reply = response.text
        if not reply:
            reply = "🌱 I received your query but couldn't generate a response. Please try rephrasing your question about crops, soil, irrigation, or pest management."
    except Exception as e:
        # Fallback if Gemini API fails
        reply = (
            f"🌾 **AgroBot Advisory:**\n\n"
            f"I'm having trouble connecting to my AI engine right now. "
            f"Regarding *\"{data.get('message')}\"*: In precision agriculture, combining soil NPK telemetry, "
            f"local ET0 weather forecasts, and targeted biological pest scouting yields a 20-35% reduction "
            f"in input costs. Please try again in a moment!\n\n"
            f"*(Error: {str(e)})*"
        )

    return jsonify({'reply': reply})

# =========================================================================
# YIELD & ECONOMIC ROI CALCULATOR API
# =========================================================================

@app.route('/api/roi-calculate', methods=['POST'])
def calculate_roi():
    data = request.get_json() or {}
    crop = data.get('crop', 'Cotton')
    acres = float(data.get('acres', 5.0))
    expected_yield_per_acre = float(data.get('yield_per_acre', 1.2)) # Tonnes or Quintals
    market_price_per_unit = float(data.get('market_price', 7200)) # Price per tonne/quintal
    seed_cost_per_acre = float(data.get('seed_cost', 2200))
    fertilizer_cost_per_acre = float(data.get('fertilizer_cost', 4500))
    irrigation_energy_cost = float(data.get('irrigation_cost', 1800))
    labor_machinery_cost = float(data.get('labor_cost', 6500))

    total_yield = acres * expected_yield_per_acre
    gross_revenue = total_yield * market_price_per_unit

    cost_per_acre = seed_cost_per_acre + fertilizer_cost_per_acre + irrigation_energy_cost + labor_machinery_cost
    total_cost = cost_per_acre * acres
    net_profit = gross_revenue - total_cost
    roi_pct = ((net_profit / total_cost) * 100) if total_cost > 0 else 0

    return jsonify({
        'crop': crop,
        'acres': acres,
        'total_yield': round(total_yield, 2),
        'gross_revenue': round(gross_revenue, 2),
        'total_cost': round(total_cost, 2),
        'cost_per_acre': round(cost_per_acre, 2),
        'net_profit': round(net_profit, 2),
        'roi_percentage': round(roi_pct, 1),
        'cost_breakdown': {
            'seeds': round(seed_cost_per_acre * acres, 2),
            'fertilizers': round(fertilizer_cost_per_acre * acres, 2),
            'irrigation_power': round(irrigation_energy_cost * acres, 2),
            'labor_machinery': round(labor_machinery_cost * acres, 2)
        }
    })

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"[Smart Agriculture System] Running at http://127.0.0.1:{port}")
    app.run(host='0.0.0.0', port=port, debug=False)
