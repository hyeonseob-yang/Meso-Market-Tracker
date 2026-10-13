import PredictionsList from "../components/predictionsList";
import { listForecastSnapshots } from "../forecastActions";

export default async function PredictionsPage() {
  const snapshots = await listForecastSnapshots();
  return <PredictionsList initialSnapshots={snapshots} />;
}
