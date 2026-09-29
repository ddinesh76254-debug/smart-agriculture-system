import os
import sys
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
from flask import Flask, render_template, request, jsonify, session
from flask_cors import CORS
from models import db, Farmer, SoilData, Crop, Recommendation, seed_database
from ml_engine import predict_crop, evaluate_soil_health, init_ml
from irrigation_engine import calculate_irrigation
from weather_service import get_weather_data

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

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"[Smart Agriculture System] Running at http://127.0.0.1:{port}")
    app.run(host='0.0.0.0', port=port, debug=False)
