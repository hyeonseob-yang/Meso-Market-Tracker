# Separate from forecasting.py (which pulls in sktime/pandas) so callers
# that only need this constant don't import that weight too.

# Compute-time safety valve, not a meaningful business lookback window.
MAX_TRAINING_DAYS = 120
