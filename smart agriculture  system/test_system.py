import sys
import os
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

import unittest
import json
from app import app
from models import db, Farmer, SoilData, Crop, Recommendation
from ml_engine import predict_crop, evaluate_soil_health, train_and_save_model
from irrigation_engine import calculate_irrigation
from weather_service import get_weather_data

class SmartAgricultureSystemTests(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        app.config['TESTING'] = True
        app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
        cls.client = app.test_client()

        with app.app_context():
            db.create_all()

    def setUp(self):
        with app.app_context():
            db.session.query(Recommendation).delete()
            db.session.query(SoilData).delete()
            db.session.query(Farmer).delete()
            db.session.commit()

            # Create test farmer
            farmer = Farmer(
                name='Test Farmer',
                email='test@farmer.com',
                phone='1234567890',
                location='Nagpur, India',
                farm_size_acres=10.0,
                soil_type='Loamy',
                primary_crop='Wheat'
            )
            farmer.set_password('password123')
            db.session.add(farmer)
            db.session.commit()
            self.test_farmer_id = farmer.farmer_id

    def test_01_ml_engine_inference(self):
        """Verify Scikit-learn ML Crop recommendation inference."""
        preds = predict_crop(n=90, p=45, k=40, temperature=26.0, humidity=80.0, ph=6.5, rainfall=1200.0, top_k=3)
        self.assertIsInstance(preds, list)
        self.assertGreater(len(preds), 0)
        self.assertIn('crop_name', preds[0])
        self.assertIn('confidence_score', preds[0])
        self.assertGreater(preds[0]['confidence_score'], 0)
        print(f"ML Prediction result for Rice-like inputs: {preds[0]['crop_name']} ({preds[0]['confidence_score']}%)")

    def test_02_soil_health_evaluator(self):
        """Verify soil health analysis and recommendations."""
        health = evaluate_soil_health(ph=6.8, n=85.0, p=48.0, k=52.0, moisture=58.0)
        self.assertIsInstance(health, dict)
        self.assertIn('score', health)
        self.assertGreaterEqual(health['score'], 80.0)
        self.assertIn('analysis', health)
        self.assertEqual(health['analysis']['ph']['status'], 'Optimal Neutral')
        print(f"Soil Health Score: {health['score']}/100")

    def test_03_irrigation_engine(self):
        """Verify smart irrigation calculations and rain delays."""
        # Case A: Low moisture -> Urgent irrigation
        dry_plan = calculate_irrigation(moisture_pct=25.0, crop_name='Wheat', farm_size_acres=5.0)
        self.assertIn(dry_plan['status'], ['CRITICAL', 'RECOMMENDED'])
        self.assertGreater(dry_plan['pump_hours_needed'], 0)

        # Case B: High rain forecast -> Hold irrigation
        rain_plan = calculate_irrigation(moisture_pct=40.0, crop_name='Wheat', forecast_rain_mm=15.0, rain_prob=80)
        self.assertEqual(rain_plan['status'], 'HOLD_IRRIGATION')

    def test_04_weather_service(self):
        """Verify weather data fetching with fallback."""
        w_data = get_weather_data(lat=21.1458, lon=79.0882)
        self.assertIn('temperature', w_data)
        self.assertIn('forecast', w_data)
        self.assertEqual(len(w_data['forecast']), 5)

    def test_05_auth_flow(self):
        """Verify registration and login REST endpoints."""
        # Test Registration
        reg_resp = self.client.post('/api/auth/register', json={
            'name': 'New Farmer',
            'email': 'new@farm.com',
            'password': 'secretpassword',
            'phone': '9876543210',
            'location': 'Pune, India'
        })
        self.assertEqual(reg_resp.status_code, 201)

        # Test Login
        login_resp = self.client.post('/api/auth/login', json={
            'email': 'new@farm.com',
            'password': 'secretpassword'
        })
        self.assertEqual(login_resp.status_code, 200)
        data = login_resp.get_json()
        self.assertEqual(data['farmer']['email'], 'new@farm.com')

    def test_06_crop_recommendation_api(self):
        """Verify /api/recommend-crop endpoint."""
        resp = self.client.post('/api/recommend-crop', json={
            'nitrogen': 85.0,
            'phosphorus': 48.0,
            'potassium': 52.0,
            'ph': 6.8,
            'moisture': 58.0,
            'temperature': 27.5,
            'humidity': 62.0,
            'rainfall': 750.0,
            'save_to_history': True
        })
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertTrue(data['success'])
        self.assertIn('top_recommendation', data)
        self.assertIn('irrigation_plan', data)

    def test_07_soil_data_and_history_api(self):
        """Verify /api/soil and /api/history endpoints."""
        # Log Soil
        post_resp = self.client.post('/api/soil', json={
            'ph': 6.5,
            'nitrogen': 80.0,
            'phosphorus': 45.0,
            'potassium': 40.0,
            'moisture': 55.0,
            'organic_matter': 2.5,
            'notes': 'Test Field Plot'
        })
        self.assertEqual(post_resp.status_code, 201)

        # Check History
        hist_resp = self.client.get('/api/history')
        self.assertEqual(hist_resp.status_code, 200)
        hist_data = hist_resp.get_json()
        self.assertGreaterEqual(len(hist_data['soil_history']), 1)

    def test_08_dashboard_summary_api(self):
        """Verify /api/dashboard-summary endpoint."""
        resp = self.client.get('/api/dashboard-summary')
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertIn('farmer', data)
        self.assertIn('soil_health_score', data)
        self.assertIn('irrigation_summary', data)

if __name__ == '__main__':
    unittest.main()
