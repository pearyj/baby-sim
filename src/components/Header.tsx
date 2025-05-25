import React from 'react';
import { AppBar, Toolbar, Typography, Box } from '@mui/material';
import { styled } from '@mui/material/styles';
import DevModelSwitcher from './DevModelSwitcher';

const StyledAppBar = styled(AppBar)(({ theme }) => ({
  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
  boxShadow: '0px 2px 4px -1px rgba(0,0,0,0.2), 0px 4px 5px 0px rgba(0,0,0,0.14), 0px 1px 10px 0px rgba(0,0,0,0.12)',
}));

const StyledTitle = styled(Typography)(({ theme }) => ({
  position: 'relative',
  fontWeight: 600,
  color: theme.palette.primary.contrastText,
  '&::after': {
    content: '""',
    position: 'absolute',
    bottom: -4,
    left: '50%',
    transform: 'translateX(-50%)',
    width: '80%',
    height: 3,
    background: theme.palette.primary.contrastText,
    opacity: 0.3,
    borderRadius: 2,
  },
}));

export const Header: React.FC = () => {
  return (
    <StyledAppBar position="fixed" elevation={2}>
      <Toolbar sx={{ maxWidth: '3xl', mx: 'auto', width: '100%', px: 2 }}>
        <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center' }}>
          <StyledTitle variant="h4" sx={{ 
            fontSize: { xs: '1.5rem', sm: '2rem' },
            textAlign: 'center'
          }}>
            养娃模拟器
          </StyledTitle>
        </Box>
        
        <Box sx={{ position: 'absolute', right: 16 }}>
          <DevModelSwitcher />
        </Box>
      </Toolbar>
    </StyledAppBar>
  );
}; 