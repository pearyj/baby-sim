import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Collapse,
  IconButton,
  Paper,
  Tooltip
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { ExpandMore, ExpandLess } from '@mui/icons-material';
import { getTimelineIcon, getCurrentAgeColor, DEVELOPMENTAL_STAGES } from '../constants/timelineIcons';
import type { GameState } from '../types/game';

interface TimelineProps {
  history: GameState['history'];
  currentAge: number;
  childGender: 'male' | 'female';
}

const TimelineContainer = styled(Box)(() => ({
  position: 'relative',
}));

const TimelineItem = styled(Box)(({ theme }) => ({
  position: 'relative',
  paddingLeft: theme.spacing(6), // Space for the icon
  paddingBottom: theme.spacing(2),
  '&:not(:last-child)::after': {
    content: '""',
    position: 'absolute',
    left: theme.spacing(2.25), // Center of the icon
    top: theme.spacing(6),
    bottom: theme.spacing(-2),
    width: 2,
    backgroundColor: theme.palette.divider,
    zIndex: 0,
  },
}));

const TimelineIcon = styled(Box)(({ theme }) => ({
  position: 'absolute',
  left: 0,
  top: theme.spacing(1),
  width: theme.spacing(4.5),
  height: theme.spacing(4.5),
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: `2px solid ${theme.palette.background.paper}`,
  boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
  zIndex: 1,
  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
  '& .MuiSvgIcon-root': {
    fontSize: '1.25rem',
    color: 'white',
  },
  '&:hover': {
    transform: 'scale(1.1)',
    boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.2)',
  },
}));

const TimelineCard = styled(Card)(() => ({
  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
  cursor: 'pointer',
  '&:hover': {
    transform: 'translateY(-1px)',
    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.12)',
  },
}));

const CurrentAgeCard = styled(TimelineCard)(() => ({
  border: `2px solid ${getCurrentAgeColor()}`,
  background: `linear-gradient(135deg, ${getCurrentAgeColor()}10 0%, ${getCurrentAgeColor()}05 100%)`,
}));

const ExpandableContent = styled(Box)(({ theme }) => ({
  borderTop: `1px solid ${theme.palette.divider}`,
  marginTop: theme.spacing(2),
  paddingTop: theme.spacing(2),
}));

export const Timeline: React.FC<TimelineProps> = ({ 
  history, 
  currentAge,
  childGender
}) => {
  const [expandedAges, setExpandedAges] = useState<number[]>([]);
  const sortedEvents = history
    .filter(event => event.question && event.question.trim() !== '')
    .sort((a, b) => a.age - b.age);
  
  const handleToggleExpand = (age: number) => {
    setExpandedAges(prevExpanded => 
      prevExpanded.includes(age)
        ? prevExpanded.filter(expanded => expanded !== age)
        : [...prevExpanded, age]
    );
  };
  
  const getDisplayText = (text: string, maxLength: number): string => {
    if (!text) return "...";
    const firstSentence = text.split(/[.!?][\s\n]/)[0];
    if (firstSentence.length > maxLength) {
      return firstSentence.substring(0, maxLength) + "...";
    }
    return firstSentence + (firstSentence.match(/[.!?]$/) ? '' : '...');
  };

  if (sortedEvents.length === 0) {
    return (
      <Paper elevation={1} sx={{ p: 3, mb: 3, textAlign: 'center' }}>
        <Typography variant="body1" color="text.secondary" sx={{ fontStyle: 'italic' }}>
          辛勤养娃的一点一滴都会被记录下来。
        </Typography>
      </Paper>
    );
  }

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h6" sx={{ mb: 3, color: 'primary.main', fontWeight: 600 }}>
        成长时间轴
      </Typography>
      
      <TimelineContainer>
        {sortedEvents.map((event, index) => {
          const isExpanded = expandedAges.includes(event.age);
          const isCurrent = event.age === currentAge;
          const isLast = index === sortedEvents.length - 1;
          const iconConfig = getTimelineIcon(event.age, childGender);
          const IconComponent = iconConfig.icon;
          const iconColor = isCurrent ? getCurrentAgeColor() : iconConfig.color;
          const developmentalStage = DEVELOPMENTAL_STAGES[event.age as keyof typeof DEVELOPMENTAL_STAGES] || '成长期';
          
          return (
            <TimelineItem key={`timeline-${event.age}-${index}`} sx={{ 
              paddingBottom: isLast ? 0 : 2 
            }}>
              <Tooltip 
                title={`${event.age}岁 - ${iconConfig.description} (${developmentalStage})`}
                placement="left"
              >
                <TimelineIcon sx={{ 
                  backgroundColor: iconColor,
                  borderColor: iconColor
                }}>
                  <IconComponent />
                </TimelineIcon>
              </Tooltip>
              
              {isCurrent ? (
                <CurrentAgeCard elevation={2} onClick={() => handleToggleExpand(event.age)}>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip 
                          label={`${event.age}岁`} 
                          color="primary" 
                          size="small"
                          variant="filled"
                        />
                        <Chip 
                          label="当前年龄" 
                          color="primary" 
                          size="small"
                          variant="outlined"
                        />
                        <Chip 
                          label={developmentalStage}
                          size="small"
                          variant="outlined"
                          sx={{ 
                            borderColor: iconColor,
                            color: iconColor 
                          }}
                        />
                      </Box>
                      <IconButton size="small" color="primary">
                        {isExpanded ? <ExpandLess /> : <ExpandMore />}
                      </IconButton>
                    </Box>
                    
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {getDisplayText(event.outcome, 80)}
                    </Typography>
                    
                    <Collapse in={isExpanded}>
                      <ExpandableContent>
                        <Typography variant="body2" sx={{ fontWeight: 500, mb: 1, color: 'primary.main' }}>
                          状况：
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 2 }}>
                          {event.question}
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500, mb: 1, color: 'primary.main' }}>
                          结果：
                        </Typography>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                          {event.outcome}
                        </Typography>
                      </ExpandableContent>
                    </Collapse>
                  </CardContent>
                </CurrentAgeCard>
              ) : (
                <TimelineCard elevation={1} onClick={() => handleToggleExpand(event.age)}>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip 
                          label={`${event.age}岁`} 
                          size="small"
                          variant="outlined"
                          sx={{ 
                            borderColor: iconColor,
                            color: iconColor
                          }}
                        />
                        <Chip 
                          label={developmentalStage}
                          size="small"
                          variant="outlined"
                          sx={{ 
                            borderColor: iconColor,
                            color: iconColor,
                            fontSize: '0.7rem'
                          }}
                        />
                      </Box>
                      <IconButton size="small">
                        {isExpanded ? <ExpandLess /> : <ExpandMore />}
                      </IconButton>
                    </Box>
                    
                    <Typography variant="body2" color="text.secondary">
                      {getDisplayText(event.outcome, 80)}
                    </Typography>
                    
                    <Collapse in={isExpanded}>
                      <ExpandableContent>
                        <Typography variant="body2" sx={{ fontWeight: 500, mb: 1, color: 'text.primary' }}>
                          状况：
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 2 }}>
                          {event.question}
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500, mb: 1, color: 'text.primary' }}>
                          结果：
                        </Typography>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                          {event.outcome}
                        </Typography>
                      </ExpandableContent>
                    </Collapse>
                  </CardContent>
                </TimelineCard>
              )}
            </TimelineItem>
          );
        })}
      </TimelineContainer>
    </Box>
  );
}; 