import {
  Box,
  Button,
  FormControl,
  FormHelperText,
  Input,
  InputLabel,
} from "@mui/material";

import { postData } from "../data/action";

export default function ManualInput() {
  return (
    <Box
      component="form"
      action={postData}
      sx={{ "& > :not(style)": { m: 1 } }}
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
        <FormHelperText id="date-desc">
          Date of when the values were recorded
        </FormHelperText>
      </FormControl>
      <FormControl>
        <InputLabel htmlFor="average">Average</InputLabel>
        <Input
          id="average"
          name="average"
          type="number"
          aria-describedby="average-desc"
        ></Input>
        <FormHelperText id="avg-desc">
          Average cost of Maple Points per 100M Mesos for recent trades
        </FormHelperText>
      </FormControl>
      <FormControl>
        <InputLabel htmlFor="buy100M">Buy Buyout 100M</InputLabel>
        <Input
          id="buy100M"
          name="buy100M"
          type="number"
          aria-describedby="buy100M-desc"
        ></Input>
        <FormHelperText id="buy100M-desc">
          Cost to buyout 100M Mesos in Maple Points per 100M Mesos
        </FormHelperText>
      </FormControl>
      <FormControl>
        <InputLabel htmlFor="buy1B">Buy Buyout 1B</InputLabel>
        <Input
          id="buy1B"
          name="buy1B"
          type="number"
          aria-describedby="buy1B-desc"
        ></Input>
        <FormHelperText id="buy1B-desc">
          Cost to buyout 1B Mesos in Maple Points per 100M Mesos
        </FormHelperText>
      </FormControl>
      <FormControl>
        <InputLabel htmlFor="buy10B">Buy Buyout 10B</InputLabel>
        <Input
          id="buy10B"
          name="buy10B"
          type="number"
          aria-describedby="buy10B-desc"
        ></Input>
        <FormHelperText id="buy10B-desc">
          Cost to buyout 10B Mesos in Maple Points per 100M Mesos
        </FormHelperText>
      </FormControl>
      <FormControl>
        <InputLabel htmlFor="sell100M">Sell Buyout 100M</InputLabel>
        <Input
          id="sell100M"
          name="sell100M"
          type="number"
          aria-describedby="sell100M-desc"
        ></Input>
        <FormHelperText id="sell100M-desc">
          Price to instantly sell 100M Mesos in Maple Points per 100M Mesos
        </FormHelperText>
      </FormControl>
      <FormControl>
        <InputLabel htmlFor="sell1B">Sell Buyout 1B</InputLabel>
        <Input
          id="sell1B"
          name="sell1B"
          type="number"
          aria-describedby="sell1B-desc"
        ></Input>
        <FormHelperText id="sell1B-desc">
          Price to instantly sell 1B Mesos in Maple Points per 100M Mesos
        </FormHelperText>
      </FormControl>
      <FormControl>
        <InputLabel htmlFor="sell10B">Sell Buyout 10B</InputLabel>
        <Input
          id="sell10B"
          name="sell10B"
          type="number"
          aria-describedby="sell10B-desc"
        ></Input>
        <FormHelperText id="sell10B-desc">
          Price to instantly sell 10B Mesos in Maple Points per 100M Mesos
        </FormHelperText>
      </FormControl>
      <FormControl>
        <InputLabel htmlFor="notes">Notes</InputLabel>
        <Input
          id="notes"
          name="notes"
          type="text"
          aria-describedby="notes-desc"
        ></Input>
        <FormHelperText id="notes-desc">Custom notes</FormHelperText>
      </FormControl>
      <Button variant="contained" color="success" type="submit">
        Record
      </Button>
    </Box>
  );
}
