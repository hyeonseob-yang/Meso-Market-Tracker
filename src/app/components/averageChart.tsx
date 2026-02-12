'use client';

import { Chart as ChartJS, CategoryScale, Legend, LinearScale, LineElement, PointElement, Title, Tooltip, ChartData } from "chart.js";
import { Line } from "react-chartjs-2";
import { AppBar, Toolbar, Typography } from '@mui/material';
import Wrapper from "./wrapper";

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

export default function AverageChart({ data }: {data: ChartData<"line">}) {
    return (
        <Wrapper>
            <Line options={options} data={data} />
        </Wrapper>
    );
}