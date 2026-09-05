import {
  Divider,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Toolbar,
} from "@mui/material";
import Link from "next/link";

import { DRAWER_WIDTH } from "./constants";

export default function NavDrawer() {
  return (
    <Drawer
      sx={{
        width: DRAWER_WIDTH,
        flexShrink: 0,
        "& .MuiDrawer-paper": {
          width: DRAWER_WIDTH,
          boxSizing: "border-box",
        },
      }}
      variant="permanent"
      anchor="left"
    >
      <Toolbar />
      <Divider />
      <List>
        {[{ text: "Chart", href: "/" }].map((item) => (
          <ListItem key={item.text} disablePadding>
            <Link
              href={item.href}
              style={{ display: "inline-block", width: "100%" }}
            >
              <ListItemButton>
                <ListItemText>{item.text}</ListItemText>
              </ListItemButton>
            </Link>
          </ListItem>
        ))}
      </List>
    </Drawer>
  );
}
