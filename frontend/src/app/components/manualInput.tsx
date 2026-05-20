import {
  Box,
  Button,
  FormControl,
  Input,
  InputLabel,
  TextField,
} from "@mui/material";

import { postData } from "../data/action";

export default function ManualInput() {
  return (
    <Box
      component="form"
      action={postData}
      sx={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: "1em",
      }}
      autoComplete="off"
    >
      <FormControl>
        <InputLabel htmlFor="datetime" shrink={true}>
          Date
        </InputLabel>
        <Input
          id="datetime"
          name="datetime"
          type="datetime-local"
          aria-describedby="date-desc"
        ></Input>
      </FormControl>
      {/* TODO: Add timezone control--> */}
      <FormControl>
        <InputLabel htmlFor="average">Average</InputLabel>
        <Input
          id="average"
          name="average"
          type="number"
          aria-describedby="average-desc"
        ></Input>
      </FormControl>
      <Box sx={{ display: "flex", flexDirection: "row", gap: "1em" }}>
        <FormControl>
          <InputLabel htmlFor="buy1B">Buy Buyout 1B</InputLabel>
          <Input
            id="buy1B"
            name="buy1B"
            type="number"
            aria-describedby="buy1B-desc"
          ></Input>
        </FormControl>
        <FormControl>
          <InputLabel htmlFor="buy10B">Buy Buyout 10B</InputLabel>
          <Input
            id="buy10B"
            name="buy10B"
            type="number"
            aria-describedby="buy10B-desc"
          ></Input>
        </FormControl>
        <FormControl>
          <InputLabel htmlFor="buy100M">Buy Buyout 100M</InputLabel>
          <Input
            id="buy100M"
            name="buy100M"
            type="number"
            aria-describedby="buy100M-desc"
          ></Input>
        </FormControl>
      </Box>
      <Box sx={{ display: "flex", flexDirection: "row", gap: "1em" }}>
        <FormControl>
          <InputLabel htmlFor="sell100M">Sell Buyout 100M</InputLabel>
          <Input
            id="sell100M"
            name="sell100M"
            type="number"
            aria-describedby="sell100M-desc"
          ></Input>
        </FormControl>
        <FormControl>
          <InputLabel htmlFor="sell1B">Sell Buyout 1B</InputLabel>
          <Input
            id="sell1B"
            name="sell1B"
            type="number"
            aria-describedby="sell1B-desc"
          ></Input>
        </FormControl>
        <FormControl>
          <InputLabel htmlFor="sell10B">Sell Buyout 10B</InputLabel>
          <Input
            id="sell10B"
            name="sell10B"
            type="number"
            aria-describedby="sell10B-desc"
          ></Input>
        </FormControl>
      </Box>
      <FormControl>
        <TextField
          id="notes"
          name="notes"
          label="Notes"
          multiline
          maxRows={4}
          aria-describedby="notes-desc"
        ></TextField>
      </FormControl>
      <Button variant="contained" color="success" type="submit">
        Record
      </Button>
    </Box>
  );
}
