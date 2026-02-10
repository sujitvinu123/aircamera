import pandas as pd

def get_pollution_summary(df):
    """
    Returns the average, max, and min AQI.
    
    Args:
        df (pd.DataFrame): DataFrame with 'AQI' column.
        
    Returns:
        dict: Summary statistics.
    """
    summary = {
        'average_AQI': df['AQI'].mean(),
        'max_AQI': df['AQI'].max(),
        'min_AQI': df['AQI'].min()
    }
    print("\n--- Pollution Summary ---")
    print(f"Average AQI: {summary['average_AQI']:.2f}")
    print(f"Max AQI: {summary['max_AQI']}")
    print(f"Min AQI: {summary['min_AQI']}")
    return summary

def get_high_risk_locations(df):
    """
    Returns locations where AQI > 200.
    
    Args:
        df (pd.DataFrame): DataFrame.
        
    Returns:
        pd.DataFrame: Filtered DataFrame with high risk locations.
    """
    high_risk_df = df[df['AQI'] > 200]
    print(f"\nFound {len(high_risk_df)} high risk records (AQI > 200).")
    return high_risk_df

def get_location_statistics(df):
    """
    Groups by location and calculates average AQI, PM2.5, PM10.
    
    Args:
        df (pd.DataFrame): DataFrame.
        
    Returns:
        pd.DataFrame: Grouped statistics.
    """
    stats = df.groupby('station_name')[['AQI', 'PM2.5', 'PM10']].mean().reset_index()
    print("\nLocation Statistics (Average):")
    print(stats)
    return stats

def identify_pollution_hotspots(df):
    """
    Returns top 10 most polluted locations sorted by AQI.
    
    Args:
        df (pd.DataFrame): DataFrame.
        
    Returns:
        pd.DataFrame: Top 10 locations.
    """
    # Assuming "locations" refers to specific records or aggregated stations?
    # Requirement says "Return top 10 most polluted locations sorted by AQI"
    # Usually hotspots implies specific areas (stations). Let's aggregate by station first to find hotspot stations.
    
    station_stats = df.groupby('station_name')['AQI'].mean().reset_index()
    hotspots = station_stats.sort_values(by='AQI', ascending=False).head(10)
    
    print("\nTop 10 Pollution Hotspots (Average AQI):")
    print(hotspots)
    return hotspots
