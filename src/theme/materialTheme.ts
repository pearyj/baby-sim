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
    borderRadius: 16, // Slightly larger for softer, modern feel
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
  // Custom tokens for glassmorphism and motion
  // Note: These live under theme.custom.* and are referenced by component styles
  custom: {
    glass: {
      bg: 'rgba(255, 255, 255, 0.6)',
      hoverBg: 'rgba(255, 255, 255, 0.68)',
      border: '1px solid rgba(255, 255, 255, 0.35)',
      divider: '1px solid rgba(0, 0, 0, 0.06)',
      blur: '12px',
      shadow: '0 10px 30px rgba(30, 30, 30, 0.08)',
      insetHighlight: 'inset 0 1px 0 rgba(255, 255, 255, 0.20)'
    },
    radius: {
      sm: 12,
      md: 16,
      lg: 20,
      xl: 24,
    },
    motion: {
      fast: '120ms',
      standard: '200ms',
      slow: '320ms',
      easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
    }
  },
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
      variants: [
        {
          props: { variant: 'soft' as any },
          style: {
            backgroundColor: 'rgba(255, 107, 53, 0.12)',
            color: '#E55A2B',
            border: '1px solid rgba(255, 107, 53, 0.24)',
            '&:hover': {
              backgroundColor: 'rgba(255, 107, 53, 0.18)'
            }
          }
        },
        {
          props: { variant: 'tonal' as any },
          style: {
            background: 'linear-gradient(135deg, rgba(255, 107, 53, 0.18) 0%, rgba(224, 159, 62, 0.18) 100%)',
            color: '#E55A2B',
            border: '1px solid rgba(255, 255, 255, 0.28)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
            '&:hover': {
              background: 'linear-gradient(135deg, rgba(255, 107, 53, 0.24) 0%, rgba(224, 159, 62, 0.24) 100%)'
            }
          }
        }
      ]
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: '0px 1px 2px 0px rgba(0, 0, 0, 0.3), 0px 1px 3px 1px rgba(0, 0, 0, 0.15)',
        },
      },
      variants: [
        {
          props: { variant: 'glass' as any },
          style: {
            backgroundColor: 'rgba(255, 255, 255, 0.6)',
            border: '1px solid rgba(255, 255, 255, 0.35)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            boxShadow: '0 10px 30px rgba(30, 30, 30, 0.08)',
            transition: 'transform 200ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 200ms cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              transform: 'translateY(-1px)',
              boxShadow: '0 12px 34px rgba(30, 30, 30, 0.10)'
            }
          }
        }
      ]
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 16,
        },
      },
      variants: [
        {
          props: { variant: 'glass' as any },
          style: {
            backgroundColor: 'rgba(255, 255, 255, 0.6)',
            border: '1px solid rgba(255, 255, 255, 0.35)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            boxShadow: '0 10px 30px rgba(30, 30, 30, 0.08)'
          }
        }
      ]
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
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: 'rgba(255, 255, 255, 0.65)',
          border: '1px solid rgba(255, 255, 255, 0.35)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          boxShadow: '0 16px 40px rgba(30, 30, 30, 0.16)',
          borderRadius: 20
        }
      }
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.12)'
        }
      }
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: 'rgba(33, 33, 33, 0.9)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)'
        }
      }
    }
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

  interface Theme {
    custom: {
      glass: {
        bg: string;
        hoverBg: string;
        border: string;
        divider: string;
        blur: string;
        shadow: string;
        insetHighlight: string;
      };
      radius: {
        sm: number;
        md: number;
        lg: number;
        xl: number;
      };
      motion: {
        fast: string;
        standard: string;
        slow: string;
        easing: string;
      };
    };
  }

  interface ThemeOptions {
    custom?: Theme['custom'];
  }
}

// Allow custom variants on specific components
declare module '@mui/material/Paper' {
  interface PaperPropsVariantOverrides {
    glass: true;
  }
}

declare module '@mui/material/Card' {
  interface CardPropsVariantOverrides {
    glass: true;
  }
}

declare module '@mui/material/Button' {
  interface ButtonPropsVariantOverrides {
    soft: true;
    tonal: true;
  }
}
