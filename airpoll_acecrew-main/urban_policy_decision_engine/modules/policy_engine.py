import pandas as pd

def generate_policy_recommendations(row):
    """
    Generates policy recommendations for a single row based on AQI and other parameters.
    
    Args:
        row (pd.Series): A row from the DataFrame.
        
    Returns:
        str: Comma-separated list of policies.
    """
    policies = []
    
    aqi = row['AQI']
    traffic = row['traffic_level'] # 1=Low, 2=Moderate, 3=High
    wind_speed = row['wind_speed']
    
    if aqi > 300:
        policies.append("Emergency pollution control")
        policies.append("Restrict all heavy vehicles")
        policies.append("Issue public health alert")
        
    if aqi > 200 and traffic == 3: # High traffic
        policies.append("Restrict heavy vehicles")
        policies.append("Divert traffic")
        policies.append("Promote public transport")
        
    if aqi > 200 and wind_speed < 2:
        policies.append("Artificial air circulation")
        policies.append("Dust suppression measures")
        
    if 100 <= aqi <= 200:
        policies.append("Monitor pollution")
        policies.append("Encourage public transport")
        
    if not policies:
        policies.append("No specific restrictions")
        
    return ", ".join(list(set(policies))) # Remove duplicates if any logic overlaps

def apply_policy_engine(df):
    """
    Applies the policy recommendation logic to the entire DataFrame.
    
    Args:
        df (pd.DataFrame): Input DataFrame.
        
    Returns:
        pd.DataFrame: DataFrame with 'recommended_policies' column.
    """
    print("\n--- Applying Policy Engine ---")
    df['recommended_policies'] = df.apply(generate_policy_recommendations, axis=1)
    print("Policy recommendations generated.")
    return df
