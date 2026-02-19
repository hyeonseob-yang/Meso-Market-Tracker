import { Box, Button, FormControl, FormHelperText, Input, InputLabel } from "@mui/material";

import { postData } from "../data/action";

export default function FileInput() {
    return (
        <Box
            component="form"
            action={postData}
            sx={{ '& > :not(style)': { m: 1 } }}
            autoComplete="off"
        >   
            <FormControl>
                <InputLabel htmlFor="file" shrink={true}>CSV File</InputLabel>
                <Input id="file" name="file" type="file" aria-describedby="file-desc"></Input>
                <FormHelperText id="file-desc">Upload a CSV file with meso market data</FormHelperText>
            </FormControl>
            <Button variant="contained" color="success" type="submit">Upload</Button>
        </Box>
    );
}