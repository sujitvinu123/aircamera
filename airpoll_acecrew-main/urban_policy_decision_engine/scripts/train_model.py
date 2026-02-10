import pandas as pd
import numpy as np
import pickle
import os
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

def train_model():
    print("-----------------------------------")
    print("      AQI PREDICTION MODEL TRAINING")
    print("-----------------------------------")

    # 1. Load Dataset
    # Assuming script is run from project root or scripts folder, adjust path accordingly
    # We'll try to find the data folder relative to this script
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    data_path = os.path.join(base_dir, "data", "final_policy_decision_dataset.csv")
    models_dir = os.path.join(base_dir, "models")
    
    if not os.path.exists(models_dir):
        os.makedirs(models_dir)
        print(f"Created models directory: {models_dir}")

    print(f"Loading dataset from: {data_path}")
    if not os.path.exists(data_path):
        print(f"Error: Dataset not found at {data_path}")
        return

    df = pd.read_csv(data_path)
    print(f"Dataset loaded. Shape: {df.shape}")

    # 2. Data Preparation
    print("Preparing data...")
    # Convert timestamp to datetime
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    
    # Sort by timestamp
    df = df.sort_values(by='timestamp')

    # 4. Feature Engineering
    print("Engineering features...")
    df['hour'] = df['timestamp'].dt.hour
    df['day'] = df['timestamp'].dt.day
    df['month'] = df['timestamp'].dt.month
    df['day_of_week'] = df['timestamp'].dt.dayofweek

    # Ensure traffic_level is numeric/encoded
    if 'traffic_level_encoded' not in df.columns:
        traffic_mapping = {'Low': 1, 'Moderate': 2, 'High': 3, 'Heavy': 4}
        df['traffic_level_encoded'] = df['traffic_level'].map(traffic_mapping).fillna(2) # Default to Moderate

    # --- NEW: Time Series Features ---
    # We need to compute lags per station to be correct
    print("Creating lag features...")
    df = df.sort_values(by=['station_name', 'timestamp'])
    
    df["AQI_lag_1"] = df.groupby("station_name")["AQI"].shift(1)
    df["AQI_lag_2"] = df.groupby("station_name")["AQI"].shift(2)
    df["AQI_lag_3"] = df.groupby("station_name")["AQI"].shift(3)
    df["AQI_lag_24"] = df.groupby("station_name")["AQI"].shift(24)
    
    # Rolling average
    df["AQI_rolling_mean_6"] = df.groupby("station_name")["AQI"].transform(lambda x: x.rolling(window=6).mean())

    # 5. Define Input Features and Target
    feature_cols = [
        'PM2.5', 'PM10', 'NO2', 'SO2', 'CO', 'O3',
        'temperature', 'humidity', 'wind_speed',
        'traffic_level_encoded', 'hour', 'day', 'month', 'day_of_week',
        'AQI_lag_1', 'AQI_lag_2', 'AQI_lag_3', 'AQI_lag_24', 'AQI_rolling_mean_6'
    ]
    target_col = 'AQI'

    # Check for missing columns (excluding the ones we just created which might be NaN for first few rows)
    # We only check for base features here
    base_features = [
        'PM2.5', 'PM10', 'NO2', 'SO2', 'CO', 'O3',
        'temperature', 'humidity', 'wind_speed',
        'traffic_level_encoded'
    ]
    missing_cols = [col for col in base_features if col not in df.columns]
    if missing_cols:
        print(f"Error: Missing columns in dataset: {missing_cols}")
        return

    # Drop rows with NaN in features or target (created by shifts/rolling)
    df_clean = df.dropna(subset=feature_cols + [target_col])
    print(f"Data after cleaning (dropping NaNs from lags): {df_clean.shape}")

    X = df_clean[feature_cols]
    y = df_clean[target_col]

    # 6. Split Dataset
    print("Splitting dataset (80% Train, 20% Test)...")
    # Using shuffle=False for time series split usually, but random split is okay 
    # if we have enough data and want to test generalizability across different time/stations.
    # For strict time series, we should split by time. Let's stick to random for now as per instructions,
    # but acknowledge time series nature.
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    # 7. Train Model
    print("Training RandomForestRegressor...")
    model = RandomForestRegressor(
        n_estimators=200,
        max_depth=12,
        random_state=42
    )
    model.fit(X_train, y_train)

    # 8. Evaluate Model
    print("Evaluating model...")
    y_pred = model.predict(X_test)
    
    mae = mean_absolute_error(y_test, y_pred)
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    r2 = r2_score(y_test, y_pred)

    print("\nModel Performance:")
    print(f"MAE: {mae:.2f}")
    print(f"RMSE: {rmse:.2f}")
    print(f"R2 Score: {r2:.4f}")

    # 9. Save Model
    model_path = os.path.join(models_dir, "aqi_prediction_model.pkl")
    with open(model_path, "wb") as f:
        pickle.dump(model, f)
    
    print(f"\nModel trained and saved successfully to: {model_path}")

if __name__ == "__main__":
    train_model()
