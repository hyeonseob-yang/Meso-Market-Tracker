'use client';

import { Chart as ChartJS, CategoryScale, Legend, LinearScale, LineElement, PointElement, Title, Tooltip } from "chart.js";
import { Line } from "react-chartjs-2";
import { faker } from '@faker-js/faker';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
);

export const options = {
    responsive: true,
    plugins: {
        legend: {
            position: 'top' as const,
        }
    },
    title: {
        display: true,
        text: 'Meso Tracker Averages'
    }
}

const labels = ['January, February', 'March', 'April', 'May', 'June', 'July'];

export const data = {
    labels,
    datasets: [
        {
            label: 'Average',
            data: labels.map(() => faker.number.int({ min: 200, max: 600 })),
        }
    ]
}

export default function Page() {
    return <Line options={options} data={data} />;
}