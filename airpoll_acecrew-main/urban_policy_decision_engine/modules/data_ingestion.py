import pandas as pd
import os

def load_dataset(file_path):
    """
    Loads the dataset from a CSV file.
    
    Args:
        file_path (str): Path to the CSV file.
        
    Returns:
        pd.DataFrame: Loaded DataFrame.
        
    Raises:
        FileNotFoundError: If the file does not exist.
        ValueError: If required columns are missing.
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found at: {file_path}")
        
    try:
        df = pd.read_csv(file_path)
        print(f"Dataset loaded successfully from {file_path}")
        return df
    except Exception as e:
        raise Exception(f"Error loading dataset: {e}")

def validate_dataset(df):
    """
    Validates the dataset structure and content.
    
    Args:
        df (pd.DataFrame): DataFrame to validate.
    """
    print("\n--- Validating Dataset ---")
    
    # Check for missing values
    missing_values = df.isnull().sum().sum()
    if missing_values > 0:
        print(f"WARNING: Dataset contains {missing_values} missing values.")
        print(df.isnull().sum())
    else:
        print("No missing values found.")
        
    # Check for duplicates
    duplicates = df.duplicated().sum()
    if duplicates > 0:
        print(f"WARNING: Dataset contains {duplicates} duplicate rows.")
    else:
        print("No duplicate rows found.")
        
    # Check data types
    print("\nData Types:")
    print(df.dtypes)
    
    # Summary stats
    print("\nDataset Summary:")
    print(df.describe())
    print("--------------------------\n")
