'use client';

import { Box, Tab } from "@mui/material";
import { TabContext, TabList, TabPanel } from "@mui/lab";

import ManualInput from "../components/manualInput";
import React from "react";
import FileInput from "../components/fileInput";

export default function Page() {
    const [value, setValue] = React.useState('1');

    const handleChange = (event: React.SyntheticEvent, newValue: string) => {
        setValue(newValue);
    };

    return (
        <Box sx={{ width: "100%", typography: "body1" }}>
            <TabContext value={value}>
                <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
                    <TabList onChange={handleChange} aria-label="tabs for input types">
                        <Tab label="Manual" value="1" />
                        <Tab label="File" value="2" />
                    </TabList>
                </Box>
                <TabPanel  value="1">
                    <ManualInput />
                </TabPanel>
                <TabPanel value="2">
                    <FileInput />
                </TabPanel>
            </TabContext>
        </Box>
    );
}