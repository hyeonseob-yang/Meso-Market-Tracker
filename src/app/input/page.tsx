import { Box, Button, FormControl, FormHelperText, Input, InputLabel } from "@mui/material";
import { postData } from "../data/action";

export default async function Page() {
    return (
        <Box
            component="form"
            action={postData}
            sx={{ '& > :not(style)': { m: 1 } }}
            autoComplete="off"
        >   
            <FormControl>
                <InputLabel htmlFor="date">Date</InputLabel>
                <Input id="date" name="date" type="datetime-local" aria-describedby="date-desc"></Input>
                <FormHelperText id="date-desc">Date of when the values were recorded</FormHelperText>
            </FormControl>
            <FormControl>
                <InputLabel htmlFor="avg">Average</InputLabel>
                <Input id="avg" name="avg" type="number" aria-describedby="avg-desc"></Input>
                <FormHelperText id="avg-desc">Average cost of Maple Points per 100M Mesos for recent trades</FormHelperText>
            </FormControl>
            <FormControl>
                <InputLabel htmlFor="buy-100m">Buy Buyout 100M</InputLabel>
                <Input id="buy-100m" name="buy-100m" type="number" aria-describedby="buy-100m-desc"></Input>
                <FormHelperText id="buy-100m-desc">Cost to buyout 100M Mesos in Maple Points per 100M Mesos</FormHelperText>
            </FormControl>
            <FormControl>
                <InputLabel htmlFor="buy-1b">Buy Buyout 1B</InputLabel>
                <Input id="buy-1b" name="buy-1b" type="number" aria-describedby="buy-1b-desc"></Input>
                <FormHelperText id="buy-1b-desc">Cost to buyout 1B Mesos in Maple Points per 100M Mesos</FormHelperText>
            </FormControl>
            <FormControl>
                <InputLabel htmlFor="buy-10b">Buy Buyout 10B</InputLabel>
                <Input id="buy-10b" name="buy-10b" type="number" aria-describedby="buy-10b-desc"></Input>
                <FormHelperText id="buy-10b-desc">Cost to buyout 10B Mesos in Maple Points per 100M Mesos</FormHelperText>
            </FormControl>
            <FormControl>
                <InputLabel htmlFor="sell-100m">Sell Buyout 100M</InputLabel>
                <Input id="sell-100m" name="sell-100m" type="number" aria-describedby="sell-100m-desc"></Input>
                <FormHelperText id="sell-100m-desc">Price to instantly sell 100M Mesos in Maple Points per 100M Mesos</FormHelperText>
            </FormControl>
            <FormControl>
                <InputLabel htmlFor="sell-1b">Sell Buyout 1B</InputLabel>
                <Input id="sell-1b" name="sell-1b" type="number" aria-describedby="sell-1b-desc"></Input>
                <FormHelperText id="sell-1b-desc">Price to instantly sell 1B Mesos in Maple Points per 100M Mesos</FormHelperText>
            </FormControl>
            <FormControl>
                <InputLabel htmlFor="sell-10b">Sell Buyout 10B</InputLabel>
                <Input id="sell-10b" name="sell-10b" type="number" aria-describedby="sell-10b-desc"></Input>
                <FormHelperText id="sell-10b-desc">Price to instantly sell 10B Mesos in Maple Points per 100M Mesos</FormHelperText>
            </FormControl>
            <Button variant="contained" color="success" type="submit">Record</Button>
        </Box>
    );
}