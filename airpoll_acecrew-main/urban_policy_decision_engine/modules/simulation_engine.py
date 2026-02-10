import pandas as pd

def simulate_policy_impact(row):
    """
    Simulates the impact of policies on AQI.
    
    Args:
        row (pd.Series): A row from the DataFrame.
        
    Returns:
        pd.Series: Contains 'predicted_AQI' and 'AQI_reduction_percent'.
    """
    pm25 = row['PM2.5']
    pm10 = row['PM10']
    no2 = row['NO2']
    aqi = row['AQI']
    
    traffic = row['traffic_level']
    wind_speed = row['wind_speed']
    
    # Apply reductions
    if traffic == 3: # High
        pm25 *= 0.80 # Reduce by 20%
        pm10 *= 0.85 # Reduce by 15%
        no2 *= 0.90 # Reduce by 10%
        
    wind_reduction_factor = 1.0
    if wind_speed < 2:
        wind_reduction_factor = 0.90 # Reduce AQI by 10% directly roughly
        
    # Re-calculating AQI is complex without the full formula (breakpoints).
    # The requirement says: "Calculate new predicted AQI based on reduced PM2.5 and PM10."
    # Since we don't have the exact formula function exposed here easily (it was in the generation script),
    # we can approximate the reduction ratio.
    # AQI is roughly proportional to the dominant pollutant.
    # Let's assume the reduction in AQI is proportional to the average reduction in PM2.5 and PM10, 
    # plus the wind factor.
    
    # Calculate effective reduction in particulate matter
    # Original PM avg
    orig_pm_avg = (row['PM2.5'] + row['PM10']) / 2
    if orig_pm_avg == 0: orig_pm_avg = 1 # Avoid div zero
    
    new_pm_avg = (pm25 + pm10) / 2
    
    pm_reduction_ratio = new_pm_avg / orig_pm_avg
    
    # Predicted AQI roughly
    predicted_aqi = aqi * pm_reduction_ratio * wind_reduction_factor
    
    # Ensure it doesn't increase (logic implies reduction)
    predicted_aqi = min(predicted_aqi, aqi)
    
    reduction_percent = ((aqi - predicted_aqi) / aqi) * 100 if aqi > 0 else 0
    
    return pd.Series([round(predicted_aqi), round(reduction_percent, 2)])

def apply_simulation(df):
    """
    Applies the simulation engine to the DataFrame.
    
    Args:
        df (pd.DataFrame): Input DataFrame.
        
    Returns:
        pd.DataFrame: DataFrame with 'predicted_AQI' and 'AQI_reduction_percent'.
    """
    print("\n--- Applying Simulation Engine ---")
    df[['predicted_AQI', 'AQI_reduction_percent']] = df.apply(simulate_policy_impact, axis=1)
    print("Simulation complete.")
    return df
