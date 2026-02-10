from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import uvicorn
import os
import sys

# Add the current directory to the system path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from modules.prediction_engine import load_prediction_model, predict_future_aqi
from modules.future_policy_engine import apply_future_policy_engine

app = FastAPI(title="Urban Policy Decision Engine API")

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables
model = None
data = None

@app.on_event("startup")
async def startup_event():
    global model, data
    print("Loading model and data...")
    try:
        model = load_prediction_model()
        # Load dataset for feature reference
        data = pd.read_csv("data/final_policy_decision_dataset.csv") 
        data['timestamp'] = pd.to_datetime(data['timestamp'])
        print("Model and data loaded successfully.")
    except Exception as e:
        print(f"Error loading resources: {e}")

@app.get("/")
def read_root():
    return {"message": "Urban Policy Decision Engine API is running"}

@app.get("/api/data")
def get_historical_data():
    if data is None:
        raise HTTPException(status_code=503, detail="Data not loaded")
    # Return a sample for now to avoid huge payload
    return data.tail(100).to_dict(orient="records")

# Simple in-memory cache
prediction_cache = {
    "data": None,
    "timestamp": None
}

@app.get("/api/future-predictions")
def get_future_predictions(hours: int = 24):
    global prediction_cache
    if model is None or data is None:
        raise HTTPException(status_code=503, detail="Model or data not available")
    
    # Check cache (valid for 1 hour for demo purposes)
    import time
    current_time = time.time()
    if prediction_cache["data"] is not None and prediction_cache["timestamp"] is not None:
        if current_time - prediction_cache["timestamp"] < 3600: # 1 hour cache
            return prediction_cache["data"]
    
    try:
        predictions_df = predict_future_aqi(data, hours_ahead=hours)
        
        # Apply Future Policy Engine
        predictions_with_policy = apply_future_policy_engine(predictions_df)
        
        result = predictions_with_policy.to_dict(orient="records")
        
        # Update cache
        prediction_cache["data"] = result
        prediction_cache["timestamp"] = current_time
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/future-predictions/{station_name}")
def get_station_predictions(station_name: str, hours: int = 24):
    if model is None or data is None:
        raise HTTPException(status_code=503, detail="Model or data not available")
    
    try:
        predictions_df = predict_future_aqi(data, hours_ahead=hours)
        
        station_preds = predictions_df[predictions_df['station_name'] == station_name]
        
        if station_preds.empty:
            raise HTTPException(status_code=404, detail="Station not found")
        
        # Apply Future Policy Engine
        station_preds_with_policy = apply_future_policy_engine(station_preds)

        return station_preds_with_policy.to_dict(orient="records")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
