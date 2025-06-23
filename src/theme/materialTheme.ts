import { createTheme } from '@mui/material/styles';

// Autumn Sunrise color scheme for a warm, family-friendly app
export const materialTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#FF6B35', // Vibrant orange for main call-to-actions
      light: '#FF8A5B',
      dark: '#E55A2B',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#FFB997', // Soft apricot for buttons/links
      light: '#FFC7A6',
      dark: '#E6A688',
      contrastText: '#333333',
    },
    tertiary: {
      main: '#E09F3E', // Mustard gold for highlights (badges, icons)
      light: '#E6B05C',
      dark: '#CC8F35',
      contrastText: '#FFFFFF',
    },
    error: {
      main: '#BA1A1A',
      light: '#DE3730',
      dark: '#93000A',
      contrastText: '#FFFFFF',
    },
    warning: {
      main: '#E09F3E', // Using accent color for warnings
      light: '#E6B05C',
      dark: '#CC8F35',
      contrastText: '#FFFFFF',
    },
    info: {
      main: '#FF6B35', // Using primary color for info
      light: '#FF8A5B',
      dark: '#E55A2B',
      contrastText: '#FFFFFF',
    },
    success: {
      main: '#4CAF50', // Keeping a green for success
      light: '#66BB6A',
      dark: '#388E3C',
      contrastText: '#FFFFFF',
    },
    background: {
      default: '#F5F5F5', // Neutral background
      paper: '#FFFFFF',
    },
    surface: {
      main: '#F5F5F5',
      variant: '#EEEEEE',
    },
    outline: {
      main: '#CCCCCC',
      variant: '#E0E0E0',
    },
    text: {
      primary: '#333333', // Neutral text
      secondary: '#666666',
      disabled: '#AAAAAA',
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
    '0px 6px 6px 0px rgba(0, 0, 0, 0.3), 0px 10px 14px 8px rgba(0, 0, 0, 0.15)',
    '0px 6px 6px 0px rgba(0, 0, 0, 0.3), 0px 10px 14px 8px rgba(0, 0, 0, 0.15)',
    '0px 6px 6px 0px rgba(0, 0, 0, 0.3), 0px 10px 14px 8px rgba(0, 0, 0, 0.15)',
    '0px 6px 6px 0px rgba(0, 0, 0, 0.3), 0px 10px 14px 8px rgba(0, 0, 0, 0.15)',
    '0px 6px 6px 0px rgba(0, 0, 0, 0.3), 0px 10px 14px 8px rgba(0, 0, 0, 0.15)',
    '0px 8px 8px 0px rgba(0, 0, 0, 0.3), 0px 12px 16px 10px rgba(0, 0, 0, 0.15)',
    '0px 8px 8px 0px rgba(0, 0, 0, 0.3), 0px 12px 16px 10px rgba(0, 0, 0, 0.15)',
    '0px 8px 8px 0px rgba(0, 0, 0, 0.3), 0px 12px 16px 10px rgba(0, 0, 0, 0.15)',
    '0px 8px 8px 0px rgba(0, 0, 0, 0.3), 0px 12px 16px 10px rgba(0, 0, 0, 0.15)',
    '0px 8px 8px 0px rgba(0, 0, 0, 0.3), 0px 12px 16px 10px rgba(0, 0, 0, 0.15)',
    '0px 10px 10px 0px rgba(0, 0, 0, 0.3), 0px 14px 18px 12px rgba(0, 0, 0, 0.15)',
    '0px 10px 10px 0px rgba(0, 0, 0, 0.3), 0px 14px 18px 12px rgba(0, 0, 0, 0.15)',
    '0px 10px 10px 0px rgba(0, 0, 0, 0.3), 0px 14px 18px 12px rgba(0, 0, 0, 0.15)',
    '0px 10px 10px 0px rgba(0, 0, 0, 0.3), 0px 14px 18px 12px rgba(0, 0, 0, 0.15)',
    '0px 12px 12px 0px rgba(0, 0, 0, 0.3), 0px 16px 20px 14px rgba(0, 0, 0, 0.15)',
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