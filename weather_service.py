import requests
import datetime

WMO_WEATHER_CODES = {
    0: {'desc': 'Clear sky ☀️', 'icon': 'fa-sun', 'condition': 'Clear'},
    1: {'desc': 'Mainly clear 🌤️', 'icon': 'fa-cloud-sun', 'condition': 'Mostly Clear'},
    2: {'desc': 'Partly cloudy ⛅', 'icon': 'fa-cloud-sun', 'condition': 'Partly Cloudy'},
    3: {'desc': 'Overcast ☁️', 'icon': 'fa-cloud', 'condition': 'Overcast'},
    45: {'desc': 'Foggy 🌫️', 'icon': 'fa-smog', 'condition': 'Fog'},
    48: {'desc': 'Depositing rime fog 🌫️', 'icon': 'fa-smog', 'condition': 'Fog'},
    51: {'desc': 'Light drizzle 🌦️', 'icon': 'fa-cloud-rain', 'condition': 'Drizzle'},
    53: {'desc': 'Moderate drizzle 🌦️', 'icon': 'fa-cloud-rain', 'condition': 'Drizzle'},
    55: {'desc': 'Dense drizzle 🌧️', 'icon': 'fa-cloud-showers-heavy', 'condition': 'Drizzle'},
    61: {'desc': 'Slight rain 🌧️', 'icon': 'fa-cloud-sun-rain', 'condition': 'Rain'},
    63: {'desc': 'Moderate rain 🌧️', 'icon': 'fa-cloud-showers-heavy', 'condition': 'Rain'},
    65: {'desc': 'Heavy rain ⛈️', 'icon': 'fa-cloud-showers-heavy', 'condition': 'Heavy Rain'},
    71: {'desc': 'Slight snow ❄️', 'icon': 'fa-snowflake', 'condition': 'Snow'},
    73: {'desc': 'Moderate snow ❄️', 'icon': 'fa-snowflake', 'condition': 'Snow'},
    75: {'desc': 'Heavy snow ❄️', 'icon': 'fa-snowflake', 'condition': 'Heavy Snow'},
    80: {'desc': 'Slight rain showers 🌦️', 'icon': 'fa-cloud-sun-rain', 'condition': 'Showers'},
    81: {'desc': 'Moderate rain showers 🌧️', 'icon': 'fa-cloud-showers-heavy', 'condition': 'Showers'},
    82: {'desc': 'Violent rain showers ⛈️', 'icon': 'fa-cloud-showers-water', 'condition': 'Showers'},
    95: {'desc': 'Thunderstorm ⚡', 'icon': 'fa-bolt', 'condition': 'Thunderstorm'},
    96: {'desc': 'Thunderstorm with slight hail ⛈️', 'icon': 'fa-bolt', 'condition': 'Thunderstorm'},
    99: {'desc': 'Thunderstorm with heavy hail ⛈️', 'icon': 'fa-bolt', 'condition': 'Thunderstorm'}
}

def get_weather_data(lat=21.1458, lon=79.0882, city_name=None):
    """
    Fetches real-time weather and 5-day forecast from Open-Meteo API.
    Gracefully falls back to realistic agro-climate simulation if offline.
    """
    if city_name:
        resolved_coords = geocode_city(city_name)
        if resolved_coords:
            lat, lon = resolved_coords['lat'], resolved_coords['lon']

    url = (
        f"https://api.open-meteo.com/v1/forecast?"
        f"latitude={lat}&longitude={lon}&"
        f"current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,weather_code,wind_speed_10m&"
        f"hourly=temperature_2m,relative_humidity_2m,precipitation_probability,rain&"
        f"daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,uv_index_max&"
        f"timezone=auto"
    )

    try:
        resp = requests.get(url, timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            return parse_weather_response(data, lat, lon, city_name)
    except Exception as e:
        print(f"Weather API fetch failed ({e}), using realistic agricultural simulation.")

    return get_simulated_weather(lat, lon, city_name)

def geocode_city(city_name):
    """Resolves city string to latitude and longitude."""
    try:
        geo_url = f"https://geocoding-api.open-meteo.com/v1/search?name={city_name}&count=1&language=en&format=json"
        resp = requests.get(geo_url, timeout=4)
        if resp.status_code == 200:
            results = resp.json().get('results')
            if results:
                return {
                    'lat': results[0]['latitude'],
                    'lon': results[0]['longitude'],
                    'name': f"{results[0]['name']}, {results[0].get('admin1', '')} {results[0].get('country', '')}".strip()
                }
    except Exception:
        pass
    return None

def parse_weather_response(data, lat, lon, city_name):
    """Formats Open-Meteo API response for frontend and irrigation engine."""
    current = data.get('current', {})
    daily = data.get('daily', {})
    hourly = data.get('hourly', {})

    w_code = current.get('weather_code', 0)
    w_info = WMO_WEATHER_CODES.get(w_code, {'desc': 'Clear sky ☀️', 'icon': 'fa-sun', 'condition': 'Clear'})

    # 5-Day Daily Forecast
    forecast_days = []
    dates = daily.get('time', [])
    max_temps = daily.get('temperature_2m_max', [])
    min_temps = daily.get('temperature_2m_min', [])
    precip_sums = daily.get('precipitation_sum', [])
    rain_probs = daily.get('precipitation_probability_max', [])
    codes = daily.get('weather_code', [])

    for i in range(min(5, len(dates))):
        d_code = codes[i] if i < len(codes) else 0
        d_info = WMO_WEATHER_CODES.get(d_code, {'desc': 'Clear ☀️', 'icon': 'fa-sun', 'condition': 'Clear'})
        
        # Parse date to human format
        dt_obj = datetime.datetime.strptime(dates[i], '%Y-%m-%d')
        day_label = 'Today' if i == 0 else dt_obj.strftime('%a, %b %d')

        forecast_days.append({
            'date': dates[i],
            'day_label': day_label,
            'temp_max': round(max_temps[i], 1) if i < len(max_temps) else 30,
            'temp_min': round(min_temps[i], 1) if i < len(min_temps) else 20,
            'rain_sum_mm': round(precip_sums[i], 1) if i < len(precip_sums) else 0.0,
            'rain_prob_pct': rain_probs[i] if i < len(rain_probs) else 0,
            'condition': d_info['condition'],
            'desc': d_info['desc'],
            'icon': d_info['icon']
        })

    # Hourly slices (next 24 hours)
    hourly_hours = []
    h_times = hourly.get('time', [])
    h_temps = hourly.get('temperature_2m', [])
    h_probs = hourly.get('precipitation_probability', [])
    h_hums = hourly.get('relative_humidity_2m', [])

    for i in range(min(24, len(h_times))):
        t_str = h_times[i]
        hour_display = t_str.split('T')[1] if 'T' in t_str else t_str
        hourly_hours.append({
            'time': hour_display,
            'temp': round(h_temps[i], 1) if i < len(h_temps) else 25.0,
            'rain_prob': h_probs[i] if i < len(h_probs) else 0,
            'humidity': h_hums[i] if i < len(h_hums) else 60
        })

    # Total next 24h expected rain
    rain_next_24h = sum([p for p in daily.get('precipitation_sum', [0])[:1]])

    return {
        'source': 'live_api',
        'location': city_name or f"Lat {lat:.2f}, Lon {lon:.2f}",
        'latitude': lat,
        'longitude': lon,
        'temperature': round(current.get('temperature_2m', 27.5), 1),
        'apparent_temperature': round(current.get('apparent_temperature', 28.5), 1),
        'humidity': round(current.get('relative_humidity_2m', 62), 1),
        'wind_speed_kmh': round(current.get('wind_speed_10m', 12.0), 1),
        'precipitation_mm': round(current.get('precipitation', 0.0), 1),
        'rain_next_24h_mm': round(rain_next_24h, 1),
        'weather_condition': w_info['condition'],
        'weather_desc': w_info['desc'],
        'weather_icon': w_info['icon'],
        'forecast': forecast_days,
        'hourly': hourly_hours
    }

def get_simulated_weather(lat=21.1458, lon=79.0882, city_name=None):
    """Realistic offline fallback weather generator."""
    today = datetime.datetime.now()
    days = []
    for i in range(5):
        dt = today + datetime.timedelta(days=i)
        days.append({
            'date': dt.strftime('%Y-%m-%d'),
            'day_label': 'Today' if i == 0 else dt.strftime('%a, %b %d'),
            'temp_max': 31.5 - i * 0.5,
            'temp_min': 21.0 + (i % 2),
            'rain_sum_mm': 0.0 if i != 2 else 4.5,
            'rain_prob_pct': 10 if i != 2 else 65,
            'condition': 'Partly Cloudy' if i != 2 else 'Scattered Rain',
            'desc': 'Partly cloudy ⛅' if i != 2 else 'Slight rain 🌧️',
            'icon': 'fa-cloud-sun' if i != 2 else 'fa-cloud-rain'
        })

    hourly = []
    for h in range(24):
        hourly.append({
            'time': f"{h:02d}:00",
            'temp': round(22 + 8 * np.sin((h - 6) / 24 * np.pi), 1),
            'rain_prob': 15 if h < 14 else 45,
            'humidity': int(65 - 15 * np.sin((h - 6) / 24 * np.pi))
        })

    return {
        'source': 'simulated',
        'location': city_name or f"Farm Station ({lat:.2f}, {lon:.2f})",
        'latitude': lat,
        'longitude': lon,
        'temperature': 28.4,
        'apparent_temperature': 29.8,
        'humidity': 64.0,
        'wind_speed_kmh': 14.2,
        'precipitation_mm': 0.0,
        'rain_next_24h_mm': 0.0,
        'weather_condition': 'Partly Cloudy',
        'weather_desc': 'Partly cloudy with good sun ⛅',
        'weather_icon': 'fa-cloud-sun',
        'forecast': days,
        'hourly': hourly
    }
