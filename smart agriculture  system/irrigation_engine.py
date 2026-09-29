import math

# Reference Crop Water Demand (mm per week during peak growth)
CROP_WATER_NEEDS = {
    'Rice (Paddy)': {'weekly_mm': 60, 'critical_stage': 'Flowering & Panicle Initiation', 'sensitivity': 'Very High', 'method': 'Basin / Controlled Flooding'},
    'Wheat': {'weekly_mm': 28, 'critical_stage': 'Crown Root Initiation & Booting', 'sensitivity': 'Medium', 'method': 'Sprinkler / Furrow'},
    'Maize (Corn)': {'weekly_mm': 32, 'critical_stage': 'Tasseling & Silking', 'sensitivity': 'High', 'method': 'Drip / Furrow'},
    'Cotton': {'weekly_mm': 35, 'critical_stage': 'Boll Formation & Flowering', 'sensitivity': 'Medium', 'method': 'Drip Irrigation'},
    'Chickpea': {'weekly_mm': 15, 'critical_stage': 'Pod Development', 'sensitivity': 'Low', 'method': 'Light Sprinkler'},
    'Sugarcane': {'weekly_mm': 55, 'critical_stage': 'Formative & Grand Growth', 'sensitivity': 'Very High', 'method': 'Drip / Furrow'},
    'Tomato': {'weekly_mm': 30, 'critical_stage': 'Fruit Setting & Enlargement', 'sensitivity': 'High', 'method': 'Micro Drip'},
    'Potato': {'weekly_mm': 25, 'critical_stage': 'Tuber Bulking', 'sensitivity': 'High', 'method': 'Drip / Sprinkler'},
    'Banana': {'weekly_mm': 50, 'critical_stage': 'Shooting & Bunch Development', 'sensitivity': 'Very High', 'method': 'Drip with Mulching'},
    'Soybean': {'weekly_mm': 26, 'critical_stage': 'Pod Filling', 'sensitivity': 'Medium', 'method': 'Furrow / Sprinkler'},
    'Pomegranate': {'weekly_mm': 18, 'critical_stage': 'Fruit Growth', 'sensitivity': 'Low', 'method': 'Drip System'},
    'Watermelon': {'weekly_mm': 22, 'critical_stage': 'Fruit Development', 'sensitivity': 'Medium', 'method': 'Drip under Silver Poly Mulch'}
}

# Soil Water Holding Capacity & Field Capacity
SOIL_SPECS = {
    'Sandy': {'field_capacity': 50.0, 'wilting_point': 15.0, 'infiltration_rate': 'Fast'},
    'Sandy Loam': {'field_capacity': 60.0, 'wilting_point': 22.0, 'infiltration_rate': 'Moderate'},
    'Loamy': {'field_capacity': 68.0, 'wilting_point': 28.0, 'infiltration_rate': 'Ideal'},
    'Clay Loam': {'field_capacity': 75.0, 'wilting_point': 34.0, 'infiltration_rate': 'Slow'},
    'Black Soil / Clayey': {'field_capacity': 80.0, 'wilting_point': 38.0, 'infiltration_rate': 'Very Slow'}
}

def calculate_irrigation(moisture_pct, crop_name='Wheat', temperature=27.0, humidity=60.0, 
                         forecast_rain_mm=0.0, rain_prob=0, farm_size_acres=5.0, soil_type='Loamy'):
    """
    Calculates intelligent irrigation recommendation incorporating
    real-time soil moisture, temperature, evapotranspiration, and upcoming rain forecasts.
    """
    soil = SOIL_SPECS.get(soil_type, SOIL_SPECS['Loamy'])
    crop_info = CROP_WATER_NEEDS.get(crop_name, {
        'weekly_mm': 28, 'critical_stage': 'Active Vegetative', 'sensitivity': 'Medium', 'method': 'Drip / Sprinkler'
    })

    field_capacity = soil['field_capacity']
    wilting_point = soil['wilting_point']
    
    # Calculate Moisture Stress
    available_water_pct = max(0.0, min(100.0, (moisture_pct - wilting_point) / (field_capacity - wilting_point) * 100))

    # Daily Reference Evapotranspiration (ET0) estimation
    # Simplified empirical formula based on temperature and vapor pressure deficit
    t_mean = max(10.0, temperature)
    et0 = 0.0023 * (t_mean + 17.8) * math.sqrt(max(1.0, 35.0 - t_mean * 0.4)) * (1.0 + (100 - humidity) / 200)
    daily_crop_water_loss_mm = round(et0 * (crop_info['weekly_mm'] / 25.0), 2)

    # Net Water Deficit in Soil (in mm depth of water needed to restore field capacity)
    if moisture_pct < field_capacity:
        raw_deficit_mm = (field_capacity - moisture_pct) * 0.6  # 1% moisture deficit ~ 0.6mm in root zone
    else:
        raw_deficit_mm = 0.0

    # Adjust for upcoming precipitation in 24-48 hours
    effective_rain = forecast_rain_mm * (rain_prob / 100.0)
    net_irrigation_needed_mm = max(0.0, raw_deficit_mm - effective_rain)

    # Pump runtime calculation
    # Standard 5 HP agricultural electric pump delivers ~500 liters/minute (30 m3/hr)
    # 1 mm of water over 1 acre = 4,047 Liters
    total_water_liters = net_irrigation_needed_mm * 4047 * farm_size_acres
    pump_flow_liters_per_min = 500.0
    pump_minutes_total = total_water_liters / pump_flow_liters_per_min if pump_flow_liters_per_min > 0 else 0
    pump_hours = round(pump_minutes_total / 60.0, 1)

    # Determine Urgency & Strategy
    if effective_rain >= 8.0 and rain_prob >= 60:
        status = 'HOLD_IRRIGATION'
        status_label = 'Hold Off (Rain Predicted 🌧️)'
        urgency = 'Standby'
        badge_color = 'blue'
        action_summary = f"Hold watering! {forecast_rain_mm} mm rain forecasted ({rain_prob}% chance). Rely on natural precipitation to conserve energy and groundwater."
        savings_message = f"Estimated water saved: {int(total_water_liters):,} Liters."
    elif moisture_pct <= wilting_point + 5.0:
        status = 'CRITICAL'
        status_label = 'Urgent Irrigation Required 🚨'
        urgency = 'Immediate'
        badge_color = 'red'
        action_summary = f"Critical soil dryness detected ({moisture_pct}%). Crop at risk of moisture stress. Run irrigation for ~{pump_hours} hours ({int(pump_minutes_total)} mins)."
        savings_message = "Schedule irrigation immediately at cooler morning hours."
    elif moisture_pct < field_capacity * 0.7:
        status = 'RECOMMENDED'
        status_label = 'Irrigation Recommended 💧'
        urgency = 'Within 24 Hours'
        badge_color = 'amber'
        action_summary = f"Soil moisture ({moisture_pct}%) is moderately low. Apply ~{round(net_irrigation_needed_mm, 1)} mm water ({pump_hours} pump hours)."
        savings_message = "Optimal watering interval maintained."
    else:
        status = 'OPTIMAL'
        status_label = 'Moisture Level Optimal ✅'
        urgency = 'No Action Needed'
        badge_color = 'green'
        action_summary = f"Soil moisture ({moisture_pct}%) is sufficient at root zone. No irrigation required today."
        savings_message = "Soil moisture remains within ideal field capacity."

    # Best time of day to irrigate
    best_time = "05:30 AM - 08:30 AM (Early Morning)" if temperature > 28 else "06:00 PM - 08:30 PM (Evening)"

    return {
        'status': status,
        'status_label': status_label,
        'urgency': urgency,
        'badge_color': badge_color,
        'action_summary': action_summary,
        'moisture_current_pct': moisture_pct,
        'soil_field_capacity_pct': field_capacity,
        'water_deficit_mm': round(net_irrigation_needed_mm, 1),
        'total_water_liters': int(total_water_liters),
        'pump_hours_needed': pump_hours,
        'pump_minutes_needed': int(pump_minutes_total),
        'daily_evapotranspiration_mm': daily_crop_water_loss_mm,
        'recommended_method': crop_info['method'],
        'critical_growth_phase': crop_info['critical_stage'],
        'best_irrigation_window': best_time,
        'forecast_rain_considered_mm': round(effective_rain, 1),
        'savings_message': savings_message
    }
