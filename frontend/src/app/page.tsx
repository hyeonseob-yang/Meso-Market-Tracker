import { parse } from "csv-parse/sync";
import { promises as fs } from "fs";
import AverageChart from "./components/averageChart";
import path from "path";

export default async function Page() {
  const filename = path.join(process.cwd(), "public/mesoMarket.csv");
  const content = await fs.readFile(filename);
  const parsed = parse(content, { bom: true });

  const labels = parsed.map((arr) => arr[0]);

  const data = {
    labels,
    datasets: [
      {
        label: "Average",
        data: parsed.map((arr) => parseInt(arr[1])),
      },
    ],
  };

  return <AverageChart data={data} />;
}
