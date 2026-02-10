import pandas as pd
import numpy as np
import datetime
import random

# Set random seed for reproducibility
np.random.seed(42)
random.seed(42)

# Define Station Data
stations = [
    {"station_id": "ST001", "station_name": "T Nagar", "latitude": 13.0418, "longitude": 80.2341},
    {"station_id": "ST002", "station_name": "Adyar", "latitude": 13.0012, "longitude": 80.2565},
    {"station_id": "ST003", "station_name": "Velachery", "latitude": 12.9815, "longitude": 80.2180},
    {"station_id": "ST004", "station_name": "Anna Nagar", "latitude": 13.0850, "longitude": 80.2101},
    {"station_id": "ST005", "station_name": "Guindy", "latitude": 13.0067, "longitude": 80.2206},
    {"station_id": "ST006", "station_name": "Tambaram", "latitude": 12.9229, "longitude": 80.1275},
    {"station_id": "ST007", "station_name": "Porur", "latitude": 13.0382, "longitude": 80.1565},
    {"station_id": "ST008", "station_name": "OMR", "latitude": 12.9716, "longitude": 80.2518},
    {"station_id": "ST009", "station_name": "Perungudi", "latitude": 12.9654, "longitude": 80.2461},
    {"station_id": "ST010", "station_name": "Nungambakkam", "latitude": 13.0626, "longitude": 80.2295},
]

# Cities and States
CITY = "Chennai"
STATE = "Tamil Nadu"

# Parameters
NUM_RECORDS = 1000

# Helper to generate random timestamp
def random_date(start, end):
    delta = end - start
    int_delta = (delta.days * 24 * 60 * 60) + delta.seconds
    random_second = random.randrange(int_delta)
    return start + datetime.timedelta(seconds=random_second)

end_date = datetime.datetime.now()
start_date = end_date - datetime.timedelta(days=30)

data = []

previous_timestamps = set()

for _ in range(NUM_RECORDS):
    # Select random station
    station = random.choice(stations)
    
    # Generate timestamp ensuring uniqueness (though simplistic, probability of collision is low)
    while True:
        timestamp = random_date(start_date, end_date).replace(microsecond=0)
        if (station['station_id'], timestamp) not in previous_timestamps:
            previous_timestamps.add((station['station_id'], timestamp))
            break
            
    # Base Weather Conditions
    temperature = round(np.random.uniform(24, 40), 1)
    humidity = round(np.random.uniform(40, 90), 1)
    wind_speed = round(np.random.uniform(0.5, 6.0), 1)
    
    # Traffic Level
    traffic_level = np.random.choice(["Low", "Moderate", "High"], p=[0.3, 0.4, 0.3])
    
    # Base Pollution Levels (Randomized)
    # PM2.5: 10-300
    pm25_base = np.random.uniform(10, 150) # Base relatively standard, spikes added later
    # PM10: 20-400
    pm10_base = np.random.uniform(20, 200)
    # NO2: 5-150
    no2_base = np.random.uniform(5, 80)
    # SO2: 2-100
    so2_base = np.random.uniform(2, 40)
    # CO: 0.3-10
    co_base = np.random.uniform(0.3, 5)
    # O3: 5-180
    o3_base = np.random.uniform(5, 100)

    # Apply Traffic Influence
    traffic_multiplier = 1.0
    if traffic_level == "Moderate":
        traffic_multiplier = np.random.uniform(1.1, 1.3)
    elif traffic_level == "High":
        traffic_multiplier = np.random.uniform(1.4, 1.8)
        
    pm25 = pm25_base * traffic_multiplier
    pm10 = pm10_base * traffic_multiplier
    no2 = no2_base * traffic_multiplier
    co = co_base * traffic_multiplier * 0.8 # CO heavily influenced by traffic
    
    # Apply Wind Influence (Higher wind -> Lower pollution)
    wind_factor = 1.0
    if wind_speed > 3.0:
        wind_factor = np.random.uniform(0.6, 0.8) # Dispersion
    elif wind_speed < 1.0:
        wind_factor = np.random.uniform(1.1, 1.3) # Stagnation
        
    pm25 *= wind_factor
    pm10 *= wind_factor
    no2 *= wind_factor
    so2 = so2_base * wind_factor # SO2 also disperses
    co *= wind_factor
    o3 = o3_base # O3 less directly correlated with simple wind/traffic in this simplistic model, kept random
    
    # Ensure values stay within bounds
    pm25 = max(10, min(300, pm25))
    pm10 = max(20, min(400, pm10))
    no2 = max(5, min(150, no2))
    so2 = max(2, min(100, so2))
    co = max(0.3, min(10, co))
    o3 = max(5, min(180, o3))

    # Calculate AQI (Simplified Max-Subindex approach)
    # Real CPCB AQI is complex breakpoints, here we simulate correlation
    # AQI is primarily driven by PM2.5 and PM10
    
    # Normalize to 0-400 roughly based on dominant pollutant
    # PM2.5 roughly 0-300 scales to 0-400 (factor 1.33)
    # PM10 roughly 0-400 scales to 0-400 (factor 1.0)
    
    aqi_from_pm25 = pm25 * 1.3
    aqi_from_pm10 = pm10 * 1.0
    
    calculated_aqi = max(aqi_from_pm25, aqi_from_pm10)
    
    # Add some noise to AQI to make it look "measured" rather than perfectly calculated
    calculated_aqi += np.random.normal(0, 10)
    
    aqi = int(max(30, min(400, calculated_aqi)))
    
    record = {
        "station_id": station["station_id"],
        "station_name": station["station_name"],
        "city": CITY,
        "state": STATE,
        "latitude": station["latitude"],
        "longitude": station["longitude"],
        "timestamp": timestamp,
        "AQI": aqi,
        "PM2.5": round(pm25, 2),
        "PM10": round(pm10, 2),
        "NO2": round(no2, 2),
        "SO2": round(so2, 2),
        "CO": round(co, 2),
        "O3": round(o3, 2),
        "temperature": temperature,
        "humidity": humidity,
        "wind_speed": wind_speed,
        "traffic_level": traffic_level
    }
    data.append(record)

# Create DataFrame
df = pd.DataFrame(data)

# Sort by timestamp for better readability
df = df.sort_values(by="timestamp")

# Validation
assert len(df) == 1000, f"Expected 1000 rows, got {len(df)}"
assert df['station_id'].nunique() > 0, "No stations found"
assert df.isnull().sum().sum() == 0, "Null values found"

# Save to CSV
filename = "simulated_cpcb_aqi_data.csv"
df.to_csv(filename, index=False)

print(f"Simulated CPCB AQI dataset with {len(df)} records successfully created.")
print(df.head())
