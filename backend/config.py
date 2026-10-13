# Lightweight, dependency-free constants needed outside forecasting.py's own
# module (which pulls in sktime/pandas) - keeping them here lets callers that
# only need the constant, not the heavy forecasting logic, avoid importing it.

# Compute-time safety valve, not a business lookback choice - benchmarked at
# ~13s fit+predict, comfortable margin under the Lambda timeout. Inert today
# (real automated history is far shorter), only binds after months of
# continuous collection.
MAX_TRAINING_DAYS = 120
