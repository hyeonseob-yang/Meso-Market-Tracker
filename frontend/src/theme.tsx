'use client';
import { createTheme } from "@mui/material/styles";

const theme = createTheme({
    components: {
        MuiInput: {
            styleOverrides: {
                root: {
                    '& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button': {
                        WebkitAppearance: 'none',
                        margin: 0,
                    }
                }
            }
        }
    }
})

export default theme;