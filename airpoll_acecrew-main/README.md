# Camera-Based Air Pollution Estimation Using Mobile Images

## Overview
This project aims to estimate air pollution **numerically** using images captured from a mobile phone camera.  
The system learns a relationship between **visual haze characteristics in outdoor images** and **sensor-measured air quality**, producing a calibrated Air Quality Index (AQI) estimate.

The camera is treated as an **optical proxy**, not a direct pollution sensor.

---

## Problem Statement
Estimate a numerical air pollution value (AQI) from a mobile phone camera image by learning a mapping between visual haze features and sensor-measured air quality.

---

## Output Definition
- **Primary Output:** Air Quality Index (AQI)
- **Output Type:** Continuous numerical value

---

## Scope
### In Scope
- Daytime outdoor image capture using a mobile phone camera
- Image preprocessing and normalization
- Region of Interest (ROI) selection focusing on sky and distant objects
- Extraction of visual haze-related features
- Supervised machine learning–based regression from image features to AQI
- Calibration and validation using physical air quality sensors

### Out of Scope
- Direct measurement of pollutants using camera
- Replacement of physical air quality sensors
- Night-time air quality estimation
- Indoor air quality estimation

---

## System Rationale
Air pollution, especially particulate matter, affects light propagation in the atmosphere, leading to:
- Reduced visibility
- Light scattering
- Color attenuation
- Loss of contrast in distant objects

These optical effects are captured by a camera and can be quantitatively mapped to air quality levels using machine learning.

---

## System Architecture
Mobile Camera Image
↓
Image Preprocessing
↓
Region of Interest Selection
↓
Visual Feature Extraction
↓
Machine Learning Regression Model
↓
Numerical AQI Estimate


---

## Data Requirements
Each data sample consists of:
- Outdoor image (daytime)
- Timestamp
- Fixed location identifier
- Corresponding sensor-measured AQI value

Image and sensor data must be time-aligned.

---

## Image Processing
- Resolution normalization
- Brightness and color normalization
- Noise reduction
- Fixed or adaptive ROI selection

These steps ensure consistency across images taken under varying lighting conditions.

---

## Feature Extraction
Visual features may include:
- Image contrast
- Edge strength
- Color channel attenuation
- Visibility-related indices
- Haze or transmission estimates

Alternatively, pretrained convolutional neural networks may be used to extract feature embeddings.

---

## Machine Learning Approach
- Model Type: Regression
- Possible Models:
  - Linear Regression
  - Support Vector Regression (SVR)
  - Random Forest Regression
- Input: Visual feature vector
- Output: AQI

Models are trained using sensor data as ground truth.

---

## Evaluation Metrics
- Mean Absolute Error (MAE)
- Root Mean Square Error (RMSE)

These metrics are used to assess estimation accuracy.

---

## Calibration and Stability
- Periodic recalibration using sensor measurements
- Drift monitoring over time
- Temporal consistency checks for AQI estimates

---

## Limitations
- Performance depends on consistent camera position and lighting
- Accuracy may degrade in rain, fog, or extreme lighting conditions
- Designed for outdoor daytime scenarios only

---

## Status
- Phase: Camera-based AQI estimation
- Focus: Reliable and calibrated numerical pollution estimation
