import pandas as pd

def generate_future_policy_recommendations(prediction_row):
    """
    Generates preventive policy recommendations based on predicted AQI and Risk Level.
    """
    aqi = prediction_row.get('predicted_AQI', 0)
    
    recommendations = []

    if aqi > 300:
        recommendations = [
            "Emergency pollution control activation",
            "Suspend heavy vehicle traffic immediately",
            "Temporary industrial shutdown within 5 km radius",
            "Issue public emergency health advisory"
        ]
    elif 200 < aqi <= 300:
        recommendations = [
            "Restrict heavy vehicle entry during peak hours",
            "Activate traffic diversion routes",
            "Promote public transport usage",
            "Issue early public health advisory"
        ]
    elif 150 < aqi <= 200:
        recommendations = [
            "Encourage public transport usage",
            "Monitor pollution closely",
            "Prepare traffic control readiness"
        ]
    else:
        recommendations = [
            "No preventive action required",
            "Continue monitoring"
        ]
    
    return recommendations

def apply_future_policy_engine(predictions_df):
    """
    Applies the future policy engine to a dataframe of predictions.
    """
    if predictions_df.empty:
        return predictions_df
    
    # Apply logic row by row
    predictions_df['future_recommended_policies'] = predictions_df.apply(
        generate_future_policy_recommendations, axis=1
    )
    
    return predictions_df
