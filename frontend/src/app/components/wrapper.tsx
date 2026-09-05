import { AppBar, Box, CssBaseline, Toolbar, Typography } from "@mui/material";
import NavDrawer from "./navDrawer";
import React from "react";

export default function Wrapper({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <Box sx={{ display: "flex" }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        sx={{ width: "calc(100% - var(--drawer-width))", ml: "var(--drawer-width)" }}
      >
        <Toolbar>
          <Typography variant="h6" noWrap component="div">
            Meso Tracker Average
          </Typography>
        </Toolbar>
      </AppBar>
      <NavDrawer></NavDrawer>
      <Box
        component="main"
        sx={{ flexGrow: 1, bgcolor: "background.default", p: 3 }}
      >
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}
