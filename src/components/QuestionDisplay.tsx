import React, { useEffect, useRef, useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  TextField,
  CircularProgress,
  Backdrop,
  Stack,
  Fade
} from '@mui/material';
import { styled } from '@mui/material/styles';
import type { Question } from '../types/game';
import { TextDisplay } from './TextDisplay';

interface QuestionDisplayProps {
  question: Question;
  onSelectOption: (optionId: string) => Promise<void>;
  isLoading: boolean;
  childName: string;
}

const StyledCard = styled(Card)(({ theme }) => ({
  position: 'relative',
  overflow: 'visible',
  background: theme.palette.background.paper,
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  marginBottom: theme.spacing(3),
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    background: `linear-gradient(90deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
    borderRadius: '12px 12px 0 0',
  },
}));

const OptionButton = styled(Button)(({ theme }) => ({
  textAlign: 'left',
  justifyContent: 'flex-start',
  padding: theme.spacing(2),
  borderRadius: theme.spacing(1.5),
  border: `1px solid ${theme.palette.divider}`,
  background: theme.palette.background.paper,
  marginBottom: theme.spacing(1.5),
  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
  '&:hover': {
    background: theme.palette.action.hover,
    borderColor: theme.palette.primary.main,
    transform: 'translateY(-2px)',
    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.12)',
  },
  '&:disabled': {
    background: theme.palette.action.disabledBackground,
    color: theme.palette.text.disabled,
  },
}));

const CustomOptionCard = styled(Card)(({ theme }) => ({
  marginTop: theme.spacing(2),
  background: `linear-gradient(135deg, ${theme.palette.primary.light}15 0%, ${theme.palette.secondary.light}15 100%)`,
  border: `1px solid ${theme.palette.primary.light}`,
}));

const LoadingOverlay = styled(Backdrop)(({ theme }) => ({
  position: 'absolute',
  background: 'rgba(255, 255, 255, 0.9)',
  color: theme.palette.primary.main,
  borderRadius: theme.spacing(1.5),
  zIndex: 1,
}));

export const QuestionDisplay: React.FC<QuestionDisplayProps> = ({
  question,
  onSelectOption,
  isLoading,
  childName
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [customOption, setCustomOption] = useState('');
  
  // Auto scroll to bottom when component mounts
  useEffect(() => {
    if (containerRef.current) {
      setTimeout(() => {
        window.scrollTo({
          top: document.body.scrollHeight,
          behavior: 'smooth'
        });
      }, 200);
    }
  }, []);

  // Reset custom option when question changes
  useEffect(() => {
    setCustomOption('');
  }, [question.id]);

  const handleCustomOptionSubmit = () => {
    if (customOption.trim()) {
      const customOptionId = `custom_${Date.now()}`;
      
      (window as any).lastCustomOption = {
        id: customOptionId,
        text: customOption.trim(),
        cost: 0
      };
      
      onSelectOption(customOptionId);
    }
  };

  return (
    <Box sx={{ width: '100%', px: { xs: 2, sm: 3 } }} ref={containerRef}>
      <Box sx={{ maxWidth: '48rem', mx: 'auto' }}>
        <Fade in timeout={500}>
          <StyledCard elevation={2}>
            <LoadingOverlay open={isLoading}>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 3 }}>
                <CircularProgress size={48} thickness={4} />
                <Typography variant="body1" sx={{ mt: 2, color: 'primary.main', fontWeight: 500 }}>
                  {childName}正在成长中...
                </Typography>
              </Box>
            </LoadingOverlay>
            
            <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
              <Box sx={{ mb: 4, textAlign: { xs: 'center', sm: 'left' } }}>
                <Typography variant="h5" component="h2" sx={{ 
                  fontWeight: 500,
                  color: 'text.primary',
                  lineHeight: 1.4,
                  fontSize: { xs: '1.25rem', sm: '1.5rem', md: '1.75rem' }
                }}>
                  <TextDisplay 
                    text={question.question}
                    paragraphClassName=""
                    inline={true}
                  />
                </Typography>
              </Box>
              
              <Stack spacing={2}>
                {question.options.map((option) => (
                  <OptionButton
                    key={option.id}
                    onClick={() => onSelectOption(option.id)}
                    disabled={isLoading}
                    fullWidth
                    variant="outlined"
                  >
                    <Box sx={{ width: '100%' }}>
                      <Typography variant="body1" sx={{ 
                        fontWeight: 500,
                        color: 'text.primary',
                        textAlign: 'left'
                      }}>
                        <TextDisplay 
                          text={`${option.id}: ${option.text}`}
                          paragraphClassName=""
                          inline={true}
                        />
                      </Typography>
                    </Box>
                  </OptionButton>
                ))}

                
                <CustomOptionCard elevation={1}>
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body1" sx={{ 
                        fontWeight: 500,
                        color: 'primary.main',
                        mb: 2
                      }}>
                        E: 我有其他想法
                      </Typography>
                    </Box>
                    
                    <Stack spacing={2}>
                      <TextField
                        fullWidth
                        multiline
                        rows={3}
                        value={customOption}
                        onChange={(e) => setCustomOption(e.target.value)}
                        placeholder="输入你的想法..."
                        disabled={isLoading}
                        inputProps={{ maxLength: 200 }}
                        variant="outlined"
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            backgroundColor: 'background.paper',
                          },
                        }}
                      />
                      
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="caption" color="text.secondary">
                          {customOption.length}/200 字符
                        </Typography>
                        <Button
                          onClick={handleCustomOptionSubmit}
                          disabled={isLoading || !customOption.trim()}
                          variant="contained"
                          color="primary"
                          sx={{ minWidth: 120 }}
                        >
                          选择这个方案
                        </Button>
                      </Box>
                    </Stack>
                  </CardContent>
                </CustomOptionCard>
              </Stack>
            </CardContent>
          </StyledCard>
        </Fade>
      </Box>
    </Box>
  );
}; 