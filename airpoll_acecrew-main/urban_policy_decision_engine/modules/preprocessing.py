import pandas as pd

def preprocess_dataset(df):
    """
    Preprocesses the dataset: converts timestamps, sorts, handles duplicates.
    
    Args:
        df (pd.DataFrame): Raw DataFrame.
        
    Returns:
        pd.DataFrame: Preprocessed DataFrame.
    """
    print("\n--- Preprocessing Dataset ---")
    
    # Convert timestamp to datetime
    if 'timestamp' in df.columns:
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        print("Converted 'timestamp' to datetime object.")
    
    # Sort by timestamp
    df = df.sort_values(by='timestamp')
    print("Sorted dataset by timestamp.")
    
    # Remove duplicates
    initial_rows = len(df)
    df = df.drop_duplicates()
    final_rows = len(df)
    if initial_rows != final_rows:
        print(f"Removed {initial_rows - final_rows} duplicate rows.")
    
    # Ensure numeric columns are correct type (coercing errors to NaN and filling if needed)
    numeric_cols = ['AQI', 'PM2.5', 'PM10', 'NO2', 'SO2', 'CO', 'O3', 
                    'temperature', 'humidity', 'wind_speed']
    
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')
            
    # Simple fillna for numeric columns with mean if any exist (though simulated data is clean)
    df[numeric_cols] = df[numeric_cols].fillna(df[numeric_cols].mean())

    print("Preprocessing complete.")
    return df

def classify_risk_levels(df):
    """
    Classifies AQI into risk levels.
    
    Args:
        df (pd.DataFrame): DataFrame with 'AQI' column.
        
    Returns:
        pd.DataFrame: DataFrame with new 'risk_level' column.
    """
    print("Classifying risk levels...")
    
    def get_risk(aqi):
        if aqi <= 100:
            return 'Low'
        elif aqi <= 200:
            return 'Moderate'
        elif aqi <= 300:
            return 'High'
        else:
            return 'Severe'
            
    df['risk_level'] = df['AQI'].apply(get_risk)
    print("Risk levels classified.")
    return df

def encode_traffic_levels(df):
    """
    Encodes 'traffic_level' column to numeric values.
    
    Low -> 1
    Moderate -> 2
    High -> 3
    
    Args:
        df (pd.DataFrame): DataFrame with 'traffic_level' column.
        
    Returns:
        pd.DataFrame: DataFrame with encoded 'traffic_level'.
    """
    print("Encoding traffic levels...")
    
    mapping = {'Low': 1, 'Moderate': 2, 'High': 3}
    # Using map for direct replacement, filling unknown with 0 or keeping as is if needed
    # Assuming data is clean as per requirements
    df['traffic_level_encoded'] = df['traffic_level'].map(mapping)
    
    # If original column needs to be replaced, we can do:
    # df['traffic_level'] = df['traffic_level'].map(mapping)
    # But usually keeping original is good for readability, taking requirement literally:
    # "Convert traffic_level" usually implies transformation. Let's update the specific column if used for analysis, 
    # but the prompt asked to "Convert traffic_level: Low -> 1...". 
    # I will replace the column values to strictly follow "Convert".
    
    df['traffic_level'] = df['traffic_level'].map(mapping).fillna(0).astype(int)
    
    print("Traffic levels encoded.")
    return df
