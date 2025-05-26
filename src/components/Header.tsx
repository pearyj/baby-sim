import React from 'react';
import { AppBar, Toolbar, Typography, Box, Switch, FormControlLabel, Tooltip } from '@mui/material';
import { styled } from '@mui/material/styles';
import DevModelSwitcher from './DevModelSwitcher';
import useGameStore from '../stores/useGameStore';

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
  const { enableStreaming, toggleStreaming, isStreaming } = useGameStore(state => ({
    enableStreaming: state.enableStreaming,
    toggleStreaming: state.toggleStreaming,
    isStreaming: state.isStreaming,
  }));

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
        
        <Box sx={{ position: 'absolute', right: 16, display: 'flex', gap: 2, alignItems: 'center' }}>
          {/* Only show streaming toggle in development mode */}
          {import.meta.env.DEV && (
            <Tooltip title={enableStreaming ? "禁用实时流式响应" : "启用实时流式响应"}>
              <FormControlLabel
                control={
                  <Switch
                    checked={enableStreaming}
                    onChange={toggleStreaming}
                    color="default"
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': {
                        color: 'white',
                        '&:hover': {
                          backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        },
                      },
                      '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                        backgroundColor: 'rgba(255, 255, 255, 0.3)',
                      },
                      '& .MuiSwitch-track': {
                        backgroundColor: 'rgba(255, 255, 255, 0.2)',
                      },
                    }}
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography variant="body2" sx={{ color: 'white', fontSize: '0.875rem' }}>
                      流式
                    </Typography>
                    {isStreaming && (
                      <Box
                        sx={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          backgroundColor: '#4CAF50',
                          animation: 'pulse 1.5s infinite',
                          '@keyframes pulse': {
                            '0%': { opacity: 1 },
                            '50%': { opacity: 0.5 },
                            '100%': { opacity: 1 },
                          },
                        }}
                      />
                    )}
                  </Box>
                }
                labelPlacement="start"
                sx={{ m: 0 }}
              />
            </Tooltip>
          )}
          <DevModelSwitcher />
        </Box>
      </Toolbar>
    </StyledAppBar>
  );
}; 