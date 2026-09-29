import datetime
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()

class Farmer(db.Model):
    __tablename__ = 'farmers'

    farmer_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    phone = db.Column(db.String(20), nullable=True)
    location = db.Column(db.String(100), default='Nagpur, India')
    latitude = db.Column(db.Float, default=21.1458)
    longitude = db.Column(db.Float, default=79.0882)
    farm_size_acres = db.Column(db.Float, default=5.0)
    soil_type = db.Column(db.String(50), default='Loamy')
    primary_crop = db.Column(db.String(50), default='Wheat')
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    # Relationships
    soil_records = db.relationship('SoilData', backref='farmer', lazy=True, cascade='all, delete-orphan')
    recommendations = db.relationship('Recommendation', backref='farmer', lazy=True, cascade='all, delete-orphan')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            'farmer_id': self.farmer_id,
            'name': self.name,
            'email': self.email,
            'phone': self.phone,
            'location': self.location,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'farm_size_acres': self.farm_size_acres,
            'soil_type': self.soil_type,
            'primary_crop': self.primary_crop,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else None
        }


class SoilData(db.Model):
    __tablename__ = 'soil_data'

    soil_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    farmer_id = db.Column(db.Integer, db.ForeignKey('farmers.farmer_id'), nullable=False)
    ph = db.Column(db.Float, nullable=False)
    nitrogen = db.Column(db.Float, nullable=False)       # mg/kg (N)
    phosphorus = db.Column(db.Float, nullable=False)     # mg/kg (P)
    potassium = db.Column(db.Float, nullable=False)      # mg/kg (K)
    moisture = db.Column(db.Float, nullable=False)       # percentage (%)
    organic_matter = db.Column(db.Float, default=2.5)   # percentage (%)
    temperature = db.Column(db.Float, default=26.0)     # °C
    humidity = db.Column(db.Float, default=65.0)        # %
    notes = db.Column(db.String(255), nullable=True)
    test_date = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    def to_dict(self):
        return {
            'soil_id': self.soil_id,
            'farmer_id': self.farmer_id,
            'ph': round(self.ph, 2),
            'nitrogen': round(self.nitrogen, 1),
            'phosphorus': round(self.phosphorus, 1),
            'potassium': round(self.potassium, 1),
            'moisture': round(self.moisture, 1),
            'organic_matter': round(self.organic_matter, 1) if self.organic_matter else 2.5,
            'temperature': round(self.temperature, 1) if self.temperature else 26.0,
            'humidity': round(self.humidity, 1) if self.humidity else 65.0,
            'notes': self.notes,
            'test_date': self.test_date.strftime('%Y-%m-%d %H:%M') if self.test_date else None
        }


class Crop(db.Model):
    __tablename__ = 'crops'

    crop_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    crop_name = db.Column(db.String(100), unique=True, nullable=False)
    category = db.Column(db.String(50), default='Grain')  # Grain, Pulse, Fruit, Cash Crop, Vegetable
    ideal_n = db.Column(db.Float, default=80.0)
    ideal_p = db.Column(db.Float, default=40.0)
    ideal_k = db.Column(db.Float, default=40.0)
    ideal_ph_min = db.Column(db.Float, default=6.0)
    ideal_ph_max = db.Column(db.Float, default=7.5)
    ideal_temp_min = db.Column(db.Float, default=18.0)
    ideal_temp_max = db.Column(db.Float, default=32.0)
    ideal_rainfall_min = db.Column(db.Float, default=600.0)
    ideal_rainfall_max = db.Column(db.Float, default=1200.0)
    season = db.Column(db.String(50), default='Kharif')    # Kharif, Rabi, Zaid, Annual
    water_requirement_mm = db.Column(db.Float, default=500.0)
    growth_duration_days = db.Column(db.Integer, default=120)
    suitable_soil = db.Column(db.String(100), default='Loamy, Clayey')
    description = db.Column(db.Text, nullable=True)
    icon = db.Column(db.String(10), default='🌾')

    def to_dict(self):
        return {
            'crop_id': self.crop_id,
            'crop_name': self.crop_name,
            'category': self.category,
            'ideal_n': self.ideal_n,
            'ideal_p': self.ideal_p,
            'ideal_k': self.ideal_k,
            'ideal_ph_min': self.ideal_ph_min,
            'ideal_ph_max': self.ideal_ph_max,
            'ideal_temp_min': self.ideal_temp_min,
            'ideal_temp_max': self.ideal_temp_max,
            'ideal_rainfall_min': self.ideal_rainfall_min,
            'ideal_rainfall_max': self.ideal_rainfall_max,
            'season': self.season,
            'water_requirement_mm': self.water_requirement_mm,
            'growth_duration_days': self.growth_duration_days,
            'suitable_soil': self.suitable_soil,
            'description': self.description,
            'icon': self.icon
        }


class Recommendation(db.Model):
    __tablename__ = 'recommendations'

    recommendation_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    farmer_id = db.Column(db.Integer, db.ForeignKey('farmers.farmer_id'), nullable=False)
    crop = db.Column(db.String(100), nullable=False)
    confidence_score = db.Column(db.Float, default=85.0)  # Percentage
    irrigation = db.Column(db.Text, nullable=False)       # Irrigation advice summary
    soil_health_score = db.Column(db.Float, default=80.0)
    recommended_fertilizers = db.Column(db.Text, nullable=True)
    top_alternatives = db.Column(db.Text, nullable=True)  # JSON or comma-separated list
    notes = db.Column(db.Text, nullable=True)
    date = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    def to_dict(self):
        return {
            'recommendation_id': self.recommendation_id,
            'farmer_id': self.farmer_id,
            'crop': self.crop,
            'confidence_score': round(self.confidence_score, 1),
            'irrigation': self.irrigation,
            'soil_health_score': round(self.soil_health_score, 1),
            'recommended_fertilizers': self.recommended_fertilizers,
            'top_alternatives': self.top_alternatives,
            'notes': self.notes,
            'date': self.date.strftime('%Y-%m-%d %H:%M') if self.date else None
        }


def seed_database():
    """Populates crops table and demo user if empty."""
    if Crop.query.count() == 0:
        sample_crops = [
            Crop(crop_name='Rice (Paddy)', category='Cereal / Grain', ideal_n=90, ideal_p=45, ideal_k=40,
                 ideal_ph_min=5.5, ideal_ph_max=7.0, ideal_temp_min=20, ideal_temp_max=35,
                 ideal_rainfall_min=1000, ideal_rainfall_max=2500, season='Kharif (Monsoon)',
                 water_requirement_mm=1200, growth_duration_days=135, suitable_soil='Clayey loam, Silt loam',
                 description='High water requirement staple grain thriving in warm and humid tropical climates.', icon='🌾'),

            Crop(crop_name='Wheat', category='Cereal / Grain', ideal_n=80, ideal_p=40, ideal_k=40,
                 ideal_ph_min=6.0, ideal_ph_max=7.5, ideal_temp_min=12, ideal_temp_max=25,
                 ideal_rainfall_min=450, ideal_rainfall_max=750, season='Rabi (Winter)',
                 water_requirement_mm=500, growth_duration_days=120, suitable_soil='Well-drained Loam, Clay loam',
                 description='Essential cool-season cereal that yields best with moderate nitrogen and regulated irrigation.', icon='🌾'),

            Crop(crop_name='Maize (Corn)', category='Cereal / Grain', ideal_n=85, ideal_p=45, ideal_k=45,
                 ideal_ph_min=5.8, ideal_ph_max=7.2, ideal_temp_min=18, ideal_temp_max=30,
                 ideal_rainfall_min=500, ideal_rainfall_max=900, season='Kharif / Spring',
                 water_requirement_mm=600, growth_duration_days=105, suitable_soil='Deep, fertile well-drained loam',
                 description='Versatile high-yield crop suitable for grain, silage, and fodder with medium water needs.', icon='🌽'),

            Crop(crop_name='Chickpea (Gram)', category='Pulse / Legume', ideal_n=40, ideal_p=65, ideal_k=80,
                 ideal_ph_min=6.0, ideal_ph_max=8.0, ideal_temp_min=15, ideal_temp_max=28,
                 ideal_rainfall_min=350, ideal_rainfall_max=650, season='Rabi (Winter)',
                 water_requirement_mm=350, growth_duration_days=100, suitable_soil='Sandy loam to clay loam',
                 description='Nitrogen-fixing drought-tolerant legume requiring minimal fertilizer and low moisture.', icon='🫘'),

            Crop(crop_name='Cotton', category='Cash / Fiber', ideal_n=120, ideal_p=50, ideal_k=50,
                 ideal_ph_min=6.0, ideal_ph_max=8.0, ideal_temp_min=21, ideal_temp_max=35,
                 ideal_rainfall_min=500, ideal_rainfall_max=1000, season='Kharif (Summer)',
                 water_requirement_mm=750, growth_duration_days=160, suitable_soil='Black cotton soil, Deep loam',
                 description='Valuable commercial fiber crop thriving in deep, moisture-retentive black soils.', icon='🌱'),

            Crop(crop_name='Sugarcane', category='Cash / Sweetener', ideal_n=150, ideal_p=60, ideal_k=90,
                 ideal_ph_min=6.5, ideal_ph_max=7.8, ideal_temp_min=20, ideal_temp_max=38,
                 ideal_rainfall_min=1200, ideal_rainfall_max=2000, season='Perennial / Annual',
                 water_requirement_mm=1800, growth_duration_days=330, suitable_soil='Deep rich loam with good drainage',
                 description='High-biomass perennial requiring substantial nutrient supply and steady drip irrigation.', icon='🎋'),

            Crop(crop_name='Tomato', category='Vegetable', ideal_n=100, ideal_p=60, ideal_k=80,
                 ideal_ph_min=6.0, ideal_ph_max=6.8, ideal_temp_min=18, ideal_temp_max=30,
                 ideal_rainfall_min=400, ideal_rainfall_max=700, season='Rabi / Kharif / Summer',
                 water_requirement_mm=550, growth_duration_days=90, suitable_soil='Sandy loam with high organic matter',
                 description='High-demand horticultural crop responding excellently to micro-drip fertigation.', icon='🍅'),

            Crop(crop_name='Potato', category='Tuber / Vegetable', ideal_n=110, ideal_p=70, ideal_k=110,
                 ideal_ph_min=5.2, ideal_ph_max=6.5, ideal_temp_min=15, ideal_temp_max=24,
                 ideal_rainfall_min=400, ideal_rainfall_max=600, season='Rabi (Winter)',
                 water_requirement_mm=450, growth_duration_days=100, suitable_soil='Friable sandy loam, loose soil',
                 description='Cool-weather root vegetable requiring high potassium and slightly acidic soil.', icon='🥔'),

            Crop(crop_name='Soybean', category='Oilseed / Legume', ideal_n=30, ideal_p=60, ideal_k=40,
                 ideal_ph_min=6.0, ideal_ph_max=7.0, ideal_temp_min=20, ideal_temp_max=32,
                 ideal_rainfall_min=600, ideal_rainfall_max=950, season='Kharif (Monsoon)',
                 water_requirement_mm=550, growth_duration_days=95, suitable_soil='Well-drained fertile loam',
                 description='Dual-purpose protein & oil rich legume fixing atmospheric nitrogen for succeeding crops.', icon='🫛'),

            Crop(crop_name='Banana', category='Fruit', ideal_n=105, ideal_p=75, ideal_k=55,
                 ideal_ph_min=5.8, ideal_ph_max=7.2, ideal_temp_min=22, ideal_temp_max=36,
                 ideal_rainfall_min=900, ideal_rainfall_max=1800, season='Perennial',
                 water_requirement_mm=1400, growth_duration_days=300, suitable_soil='Deep clay loam rich in humus',
                 description='Fast-growing heavy feeder fruit requiring abundant potassium and continuous moisture.', icon='🍌'),

            Crop(crop_name='Pomegranate', category='Fruit', ideal_n=25, ideal_p=20, ideal_k=40,
                 ideal_ph_min=6.5, ideal_ph_max=8.2, ideal_temp_min=18, ideal_temp_max=38,
                 ideal_rainfall_min=300, ideal_rainfall_max=700, season='Perennial / Semi-Arid',
                 water_requirement_mm=400, growth_duration_days=210, suitable_soil='Well-drained light loamy or gravelly soil',
                 description='Hardy semi-arid high value fruit crop tolerant to dry spells and alkaline soils.', icon='🍎'),

            Crop(crop_name='Watermelon', category='Fruit / Cucurbit', ideal_n=95, ideal_p=25, ideal_k=50,
                 ideal_ph_min=6.0, ideal_ph_max=7.0, ideal_temp_min=24, ideal_temp_max=38,
                 ideal_rainfall_min=300, ideal_rainfall_max=600, season='Zaid (Summer)',
                 water_requirement_mm=400, growth_duration_days=85, suitable_soil='Sandy loam with good warmth',
                 description='Warm-weather vine crop delivering quick turnover during sunny summer months.', icon='🍉')
        ]
        db.session.bulk_save_objects(sample_crops)
        db.session.commit()

    # Seed demo farmer if not exists
    if Farmer.query.count() == 0:
        demo_farmer = Farmer(
            name='Rajesh Patil',
            email='farmer@smartagri.com',
            phone='+91 98765 43210',
            location='Nagpur, Maharashtra, India',
            latitude=21.1458,
            longitude=79.0882,
            farm_size_acres=8.5,
            soil_type='Black Loamy Soil',
            primary_crop='Cotton'
        )
        demo_farmer.set_password('farmer123')
        db.session.add(demo_farmer)
        db.session.commit()

        # Seed sample soil data
        sample_soil = SoilData(
            farmer_id=demo_farmer.farmer_id,
            ph=6.8,
            nitrogen=85.0,
            phosphorus=48.0,
            potassium=52.0,
            moisture=58.0,
            organic_matter=2.8,
            temperature=27.5,
            humidity=62.0,
            notes='Pre-monsoon soil test sample from East Sector Plot A'
        )
        db.session.add(sample_soil)
        db.session.commit()

        # Seed sample recommendation
        sample_rec = Recommendation(
            farmer_id=demo_farmer.farmer_id,
            crop='Cotton',
            confidence_score=94.2,
            irrigation='Moderate drip irrigation required: 25 mm/week. Soil moisture is at optimal 58%. Hold watering if 24h rain occurs.',
            soil_health_score=88.5,
            recommended_fertilizers='Apply Urea (40 kg/ha) at vegetative phase, Single Super Phosphate (SSP 60 kg/ha), and Muriate of Potash (MOP 25 kg/ha).',
            top_alternatives='Maize (89.1%), Soybean (84.6%)',
            notes='Ideal conditions for sowing season Kharif. Soil pH 6.8 is optimum.'
        )
        db.session.add(sample_rec)
        db.session.commit()
