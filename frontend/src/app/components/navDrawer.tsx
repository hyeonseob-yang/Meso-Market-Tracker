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

const drawerWidth = 240;

export default function NavDrawer() {
  return (
    <Drawer
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        "& .MuiDrawer-paper": {
          width: drawerWidth,
          boxSizing: "border-box",
        },
      }}
      variant="permanent"
      anchor="left"
    >
      <Toolbar />
      <Divider />
      <List>
        {[
          { text: "Chart", href: "/" },
          { text: "Data Input", href: "/input" },
        ].map((item) => (
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
