import { createTheme } from '@mui/material/styles';

// Material Design 3 color tokens for a warm, family-friendly app
export const materialTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#6750A4', // Material Design 3 primary purple
      light: '#9A82DB',
      dark: '#4F378B',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#625B71', // Material Design 3 secondary
      light: '#8B8199',
      dark: '#483F56',
      contrastText: '#FFFFFF',
    },
    tertiary: {
      main: '#7D5260', // Warm tertiary for baby theme
      light: '#A87C8E',
      dark: '#633B48',
      contrastText: '#FFFFFF',
    },
    error: {
      main: '#BA1A1A',
      light: '#DE3730',
      dark: '#93000A',
      contrastText: '#FFFFFF',
    },
    warning: {
      main: '#7D5700',
      light: '#A6770B',
      dark: '#5E4200',
      contrastText: '#FFFFFF',
    },
    info: {
      main: '#006397',
      light: '#4F8BC4',
      dark: '#004771',
      contrastText: '#FFFFFF',
    },
    success: {
      main: '#006E1C',
      light: '#4D8F47',
      dark: '#005314',
      contrastText: '#FFFFFF',
    },
    background: {
      default: '#FEF7FF', // Material Design 3 surface
      paper: '#FFFFFF',
    },
    surface: {
      main: '#FEF7FF',
      variant: '#E7E0EC',
    },
    outline: {
      main: '#79747E',
      variant: '#CAC4D0',
    },
    text: {
      primary: '#1D1B20',
      secondary: '#49454F',
      disabled: '#C7C5CA',
    },
  },
  typography: {
    fontFamily: [
      'Inter',
      '"Noto Sans SC"', // Chinese font support
      '"Microsoft YaHei"',
      '"PingFang SC"',
      'system-ui',
      'sans-serif'
    ].join(','),
    // Use standard Material-UI typography variants
    h1: {
      fontSize: '2.25rem',
      fontWeight: 400,
      lineHeight: 1.22,
      letterSpacing: 0,
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 400,
      lineHeight: 1.25,
      letterSpacing: 0,
    },
    h3: {
      fontSize: '1.75rem',
      fontWeight: 400,
      lineHeight: 1.29,
      letterSpacing: 0,
    },
    h4: {
      fontSize: '1.5rem',
      fontWeight: 400,
      lineHeight: 1.33,
      letterSpacing: 0,
    },
    h5: {
      fontSize: '1.375rem',
      fontWeight: 400,
      lineHeight: 1.27,
      letterSpacing: 0,
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 500,
      lineHeight: 1.5,
      letterSpacing: '0.009375em',
    },
    subtitle1: {
      fontSize: '1rem',
      fontWeight: 400,
      lineHeight: 1.5,
      letterSpacing: '0.009375em',
    },
    subtitle2: {
      fontSize: '0.875rem',
      fontWeight: 500,
      lineHeight: 1.43,
      letterSpacing: '0.00625em',
    },
    body1: {
      fontSize: '1rem',
      fontWeight: 400,
      lineHeight: 1.5,
      letterSpacing: '0.009375em',
    },
    body2: {
      fontSize: '0.875rem',
      fontWeight: 400,
      lineHeight: 1.43,
      letterSpacing: '0.015625em',
    },
    button: {
      fontSize: '0.875rem',
      fontWeight: 500,
      lineHeight: 1.43,
      letterSpacing: '0.00625em',
      textTransform: 'none',
    },
    caption: {
      fontSize: '0.75rem',
      fontWeight: 400,
      lineHeight: 1.33,
      letterSpacing: '0.025em',
    },
    overline: {
      fontSize: '0.6875rem',
      fontWeight: 500,
      lineHeight: 1.45,
      letterSpacing: '0.03125em',
    },
  },
  shape: {
    borderRadius: 12, // Material Design 3 uses larger border radius
  },
  shadows: [
    'none',
    '0px 1px 2px 0px rgba(0, 0, 0, 0.3), 0px 1px 3px 1px rgba(0, 0, 0, 0.15)',
    '0px 1px 2px 0px rgba(0, 0, 0, 0.3), 0px 2px 6px 2px rgba(0, 0, 0, 0.15)',
    '0px 1px 3px 0px rgba(0, 0, 0, 0.3), 0px 4px 8px 3px rgba(0, 0, 0, 0.15)',
    '0px 2px 3px 0px rgba(0, 0, 0, 0.3), 0px 6px 10px 4px rgba(0, 0, 0, 0.15)',
    '0px 4px 4px 0px rgba(0, 0, 0, 0.3), 0px 8px 12px 6px rgba(0, 0, 0, 0.15)',
    '0px 4px 4px 0px rgba(0, 0, 0, 0.3), 0px 8px 12px 6px rgba(0, 0, 0, 0.15)',
    '0px 4px 4px 0px rgba(0, 0, 0, 0.3), 0px 8px 12px 6px rgba(0, 0, 0, 0.15)',
    '0px 4px 4px 0px rgba(0, 0, 0, 0.3), 0px 8px 12px 6px rgba(0, 0, 0, 0.15)',
    '0px 4px 4px 0px rgba(0, 0, 0, 0.3), 0px 8px 12px 6px rgba(0, 0, 0, 0.15)',
  ] as any,
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 20,
          fontWeight: 500,
          fontSize: '0.875rem',
          padding: '10px 24px',
        },
        contained: {
          boxShadow: '0px 1px 2px 0px rgba(0, 0, 0, 0.3), 0px 1px 3px 1px rgba(0, 0, 0, 0.15)',
          '&:hover': {
            boxShadow: '0px 1px 2px 0px rgba(0, 0, 0, 0.3), 0px 2px 6px 2px rgba(0, 0, 0, 0.15)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0px 1px 2px 0px rgba(0, 0, 0, 0.3), 0px 1px 3px 1px rgba(0, 0, 0, 0.15)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 12,
          },
        },
      },
    },
  },
});

// Augment the theme to include custom colors
declare module '@mui/material/styles' {
  interface Palette {
    tertiary: Palette['primary'];
    surface: {
      main: string;
      variant: string;
    };
    outline: {
      main: string;
      variant: string;
    };
  }

  interface PaletteOptions {
    tertiary?: PaletteOptions['primary'];
    surface?: {
      main: string;
      variant: string;
    };
    outline?: {
      main: string;
      variant: string;
    };
  }
} 