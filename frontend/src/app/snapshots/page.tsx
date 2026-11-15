import SnapshotsList from "../components/snapshotsList";
import { listForecastSnapshots } from "../forecastActions";

export default async function SnapshotsPage() {
  const snapshots = await listForecastSnapshots();
  return <SnapshotsList initialSnapshots={snapshots} />;
}
