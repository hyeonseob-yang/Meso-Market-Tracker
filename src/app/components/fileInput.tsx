import { Box, Button, FormControl } from "@mui/material";

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
            </FormControl>
            <Button variant="contained" color="success" type="submit">Upload</Button>
        </Box>
    );
}