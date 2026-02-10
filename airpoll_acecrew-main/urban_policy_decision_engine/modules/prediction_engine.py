import pandas as pd
import numpy as np
import pickle
import os
import random
from datetime import timedelta

# Define paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(BASE_DIR, "models", "aqi_prediction_model.pkl")

_model = None

def load_prediction_model():
    """
    Loads the trained ML model from disk.
    """
    global _model
    if _model is not None:
        return _model
    
    try:
        if not os.path.exists(MODEL_PATH):
            raise FileNotFoundError(f"Model file not found at {MODEL_PATH}")
            
        with open(MODEL_PATH, "rb") as f:
            _model = pickle.load(f)
        print("AQI Prediction Model loaded successfully.")
        return _model
    except Exception as e:
        print(f"Error loading model: {e}")
        return None

def simulate_future_features(current_features, last_features, future_time):
    """
    Simulates feature values for a future timestamp based on logic and randomness.
    """
    # 1. Update Time Features
    current_features['hour'] = future_time.hour
    current_features['day'] = future_time.day
    current_features['month'] = future_time.month
    current_features['day_of_week'] = future_time.dayofweek
    
    # 2. Simulate Traffic based on Hour
    # Rush hours: 8-11am (8-11), 5-8pm (17-20)
    hour = future_time.hour
    if 8 <= hour <= 11 or 17 <= hour <= 20:
        current_features['traffic_level_encoded'] = 3 # High
    elif 12 <= hour <= 16 or 21 <= hour <= 22:
        current_features['traffic_level_encoded'] = 2 # Moderate
    else:
        current_features['traffic_level_encoded'] = 1 # Low

    # 3. Simulate Weather (Random Walk)
    # Add small random variation to previous step's values
    current_features['temperature'] = last_features['temperature'] + random.uniform(-0.5, 0.5)
    current_features['humidity'] = max(0, min(100, last_features['humidity'] + random.uniform(-2, 2)))
    current_features['wind_speed'] = max(0, last_features['wind_speed'] + random.uniform(-0.5, 0.5))

    # 4. Simulate Pollutants (PM2.5, etc) loosely based on Traffic
    # If traffic is high, pollutants tend to increase, else decrease
    # utilizing a simplified factor
    traffic_factor = 1.0 if current_features['traffic_level_encoded'] > 1 else 0.95
    if current_features['traffic_level_encoded'] == 3:
        traffic_factor = 1.05
    
    pollutants = ['PM2.5', 'PM10', 'NO2', 'CO', 'SO2', 'O3']
    for p in pollutants:
        # random drift + traffic influence
        drift = random.uniform(-0.02, 0.02)
        current_features[p] = max(0, last_features[p] * traffic_factor * (1 + drift))
    
    return current_features

def predict_future_aqi(df, hours_ahead=24):
    """
    Predicts AQI for the next `hours_ahead` hours using recursive forecasting.
    """
    model = load_prediction_model()
    if model is None:
        return pd.DataFrame()

    latest_timestamp = pd.to_datetime(df['timestamp']).max()
    unique_stations = df['station_name'].unique()
    future_predictions = []

    # Features expected by the model
    feature_order = [
        'PM2.5', 'PM10', 'NO2', 'SO2', 'CO', 'O3',
        'temperature', 'humidity', 'wind_speed',
        'traffic_level_encoded', 'hour', 'day', 'month', 'day_of_week',
        'AQI_lag_1', 'AQI_lag_2', 'AQI_lag_3', 'AQI_lag_24', 'AQI_rolling_mean_6'
    ]

    for station in unique_stations:
        # Get historical data for this station to build lag buffer
        station_df = df[df['station_name'] == station].sort_values(by='timestamp')
        if station_df.empty:
            continue
            
        # We need at least 24 hours of history to properly initialize lags
        # If not available, we pad with the last known value
        history_values = station_df['AQI'].tolist()
        if len(history_values) < 24:
            # Pad with the last value if history is short (edge case)
            history_values = [history_values[-1]] * (24 - len(history_values)) + history_values

        last_row = station_df.iloc[-1]
        
        # Initialize current features from the last known data point
        current_features = {col: last_row[col] for col in feature_order if col in last_row}
        # Ensure traffic_level_encoded is present
        if 'traffic_level_encoded' not in current_features:
             current_features['traffic_level_encoded'] = 2 # Default
        
        # Helper to maintain features for next iteration simulation
        last_simulated_features = current_features.copy()

        for i in range(1, hours_ahead + 1):
            future_time = latest_timestamp + timedelta(hours=i)
            
            # 1. Simulate Features (Weather, Traffic, Pollutants)
            last_simulated_features = simulate_future_features(last_simulated_features.copy(), last_simulated_features, future_time)
            
            # 2. Calculate Lags and Rolling Mean from History
            # History buffer: [... t-25, t-24, ... t-3, t-2, t-1]
            lag_1 = history_values[-1]
            lag_2 = history_values[-2]
            lag_3 = history_values[-3]
            lag_24 = history_values[-24]
            rolling_mean_6 = np.mean(history_values[-6:])
            
            # 3. Construct Feature Vector for Model
            input_features = last_simulated_features.copy()
            input_features['AQI_lag_1'] = lag_1
            input_features['AQI_lag_2'] = lag_2
            input_features['AQI_lag_3'] = lag_3
            input_features['AQI_lag_24'] = lag_24
            input_features['AQI_rolling_mean_6'] = rolling_mean_6
            
            # Ensure correct order
            feature_vector = pd.DataFrame([input_features])[feature_order]
            
            # 4. Predict AQI
            try:
                predicted_aqi = model.predict(feature_vector)[0]
                
                # Add controlled randomness to prevent flat lines if model is too stable
                predicted_aqi += random.uniform(-5, 5)
                predicted_aqi = max(0, predicted_aqi) # Ensure non-negative
                
            except Exception as e:
                print(f"Prediction error for {station} at {future_time}: {e}")
                predicted_aqi = lag_1 # Fallback to previous value
            
            # 5. Update History
            history_values.append(predicted_aqi)
            
            # 6. Store Result
            risk_level = "Low"
            if predicted_aqi > 300: risk_level = "Severe"
            elif predicted_aqi > 200: risk_level = "High"
            elif predicted_aqi > 100: risk_level = "Moderate"

            future_predictions.append({
                'station_name': station,
                'future_timestamp': future_time,
                'predicted_AQI': int(predicted_aqi),
                'risk_level': risk_level,
                'latitude': last_row['latitude'], 
                'longitude': last_row['longitude']
            })

    return pd.DataFrame(future_predictions)
