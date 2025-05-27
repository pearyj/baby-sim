import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  IconButton,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  useTheme,
  Tooltip
} from '@mui/material';
import {
  Speed as SpeedIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Api as ApiIcon,
  Computer as ComputerIcon,
  Palette as PaletteIcon
} from '@mui/icons-material';
import { performanceMonitor } from '../../utils/performanceMonitor';

interface PerformanceMonitorProps {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
  autoRefresh = false,
  refreshInterval = 1000
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [metrics, setMetrics] = useState(performanceMonitor.getMetrics());
  const [summary, setSummary] = useState(performanceMonitor.getSummary());
  const theme = useTheme();

  const refreshMetrics = () => {
    const newMetrics = performanceMonitor.getMetrics();
    const newSummary = performanceMonitor.getSummary();
    
    setMetrics(newMetrics);
    setSummary(newSummary);
  };

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(refreshMetrics, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval]);

  useEffect(() => {
    refreshMetrics();
    
    // Add some test metrics for debugging
    if (import.meta.env.DEV) {
      performanceMonitor.timeSync('test-ui-render', 'ui', () => {
        // Simulate some UI work
        const start = Date.now();
        while (Date.now() - start < 50) {} // 50ms of work
      });
      
      performanceMonitor.timeSync('test-local-processing', 'local', () => {
        // Simulate some local processing
        const start = Date.now();
        while (Date.now() - start < 30) {} // 30ms of work
      });
      
      // Simulate an API call
      performanceMonitor.timeAsync('test-api-call', 'api', async () => {
        await new Promise(resolve => setTimeout(resolve, 100)); // 100ms API call
      });
      
      // Refresh after adding test metrics
      setTimeout(refreshMetrics, 200);
    }
  }, []);

  const getCategoryIcon = (category: 'api' | 'local' | 'ui') => {
    switch (category) {
      case 'api': return <ApiIcon fontSize="small" />;
      case 'local': return <ComputerIcon fontSize="small" />;
      case 'ui': return <PaletteIcon fontSize="small" />;
    }
  };

  const getCategoryColor = (category: 'api' | 'local' | 'ui') => {
    switch (category) {
      case 'api': return 'primary';
      case 'local': return 'secondary';
      case 'ui': return 'success';
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getPerformanceColor = (duration: number) => {
    if (duration < 100) return theme.palette.success.main;
    if (duration < 1000) return theme.palette.warning.main;
    return theme.palette.error.main;
  };

  if (metrics.length === 0) {
    return null;
  }

  // Calculate maximum height for the expanded view
  // Leave space for the header (100px), bottom margin (32px), and card header (120px)
  const maxExpandedHeight = window.innerHeight - 252;
  const maxTableHeight = maxExpandedHeight - 200; // Space for card header and summary

  // Compact collapsed view
  if (!isExpanded) {
    return (
      <Card sx={{ 
        position: 'fixed', 
        bottom: 16, 
        right: 16, 
        zIndex: 1000,
        transition: 'all 0.3s ease',
        minWidth: 'auto'
      }}>
        <CardContent sx={{ 
          p: 1,
          '&:last-child': { pb: 1 }
        }}>
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 1
          }}>
            <Tooltip title="性能监控 - 点击展开详情">
              <IconButton 
                size="small" 
                onClick={() => setIsExpanded(true)}
                sx={{ p: 0.5 }}
              >
                <SpeedIcon fontSize="small" color="primary" />
              </IconButton>
            </Tooltip>
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <ApiIcon fontSize="small" color="primary" />
                <Typography variant="caption" sx={{ 
                  color: 'primary.main',
                  fontSize: '0.7rem',
                  minWidth: 'max-content',
                  fontWeight: summary.api > 100 ? 'bold' : 'normal'
                }}>
                  {formatDuration(summary.api)}
                </Typography>
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <ComputerIcon fontSize="small" color="secondary" />
                <Typography variant="caption" sx={{ 
                  color: 'secondary.main',
                  fontSize: '0.7rem',
                  minWidth: 'max-content',
                  fontWeight: summary.local > 100 ? 'bold' : 'normal'
                }}>
                  {formatDuration(summary.local)}
                </Typography>
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <PaletteIcon fontSize="small" color="success" />
                <Typography variant="caption" sx={{ 
                  color: 'success.main',
                  fontSize: '0.7rem',
                  minWidth: 'max-content',
                  fontWeight: summary.ui > 100 ? 'bold' : 'normal'
                }}>
                  {formatDuration(summary.ui)}
                </Typography>
              </Box>
              
              <Typography variant="caption" sx={{ 
                color: 'text.secondary',
                fontSize: '0.7rem',
                ml: 0.5,
                fontWeight: 'bold'
              }}>
                = {formatDuration(summary.total)}
              </Typography>
              
              <IconButton 
                size="small" 
                onClick={() => setIsExpanded(true)}
                sx={{ p: 0.5, ml: 0.5 }}
              >
                <ExpandMoreIcon fontSize="small" />
              </IconButton>
              
              {/* Debug buttons in development */}
              {import.meta.env.DEV && (
                <>
                  <Tooltip title="手动刷新">
                    <IconButton 
                      size="small" 
                      onClick={refreshMetrics}
                      sx={{ p: 0.5 }}
                    >
                      <Typography variant="caption" sx={{ fontSize: '0.6rem' }}>🔄</Typography>
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="清除指标">
                    <IconButton 
                      size="small" 
                      onClick={() => {
                        performanceMonitor.clear();
                        refreshMetrics();
                      }}
                      sx={{ p: 0.5 }}
                    >
                      <Typography variant="caption" sx={{ fontSize: '0.6rem' }}>🧹</Typography>
                    </IconButton>
                  </Tooltip>
                </>
              )}
            </Box>
          </Box>
        </CardContent>
      </Card>
    );
  }

  // Expanded view
  return (
    <Card sx={{ 
      position: 'fixed', 
      bottom: 16, 
      right: 16, 
      width: 600,
      maxHeight: `${maxExpandedHeight}px`,
      zIndex: 1000,
      transition: 'all 0.3s ease',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <CardContent sx={{ 
        pb: 1, 
        display: 'flex', 
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden'
      }}>
        {/* Fixed header - always visible */}
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          flexShrink: 0
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SpeedIcon color="primary" />
            <Typography variant="h6" sx={{ fontSize: '1rem' }}>
              性能监控
            </Typography>
            {import.meta.env.DEV && (
              <Typography variant="caption" sx={{ color: 'text.secondary', ml: 1 }}>
                (调试模式)
              </Typography>
            )}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {import.meta.env.DEV && (
              <>
                <Tooltip title="手动刷新">
                  <IconButton 
                    size="small" 
                    onClick={refreshMetrics}
                    sx={{ p: 0.5 }}
                  >
                    <Typography variant="caption" sx={{ fontSize: '0.8rem' }}>🔄</Typography>
                  </IconButton>
                </Tooltip>
                <Tooltip title="清除所有指标">
                  <IconButton 
                    size="small" 
                    onClick={() => {
                      performanceMonitor.clear();
                      refreshMetrics();
                    }}
                    sx={{ p: 0.5 }}
                  >
                    <Typography variant="caption" sx={{ fontSize: '0.8rem' }}>🧹</Typography>
                  </IconButton>
                </Tooltip>
              </>
            )}
            <IconButton 
              size="small" 
              onClick={() => setIsExpanded(false)}
            >
              <ExpandLessIcon />
            </IconButton>
          </Box>
        </Box>

        {/* Summary chips - always visible when collapsed, scrollable when expanded */}
        <Box sx={{ 
          display: 'flex', 
          gap: 1, 
          mt: 1, 
          flexWrap: 'wrap',
          flexShrink: 0
        }}>
          <Chip 
            icon={<ApiIcon />}
            label={`API: ${formatDuration(summary.api)}`}
            size="small"
            color={getCategoryColor('api')}
            variant="outlined"
          />
          <Chip 
            icon={<ComputerIcon />}
            label={`本地: ${formatDuration(summary.local)}`}
            size="small"
            color={getCategoryColor('local')}
            variant="outlined"
          />
          <Chip 
            icon={<PaletteIcon />}
            label={`UI: ${formatDuration(summary.ui)}`}
            size="small"
            color={getCategoryColor('ui')}
            variant="outlined"
          />
        </Box>

        <Typography variant="body2" sx={{ 
          mt: 1, 
          color: 'text.secondary',
          flexShrink: 0
        }}>
          总计: {formatDuration(summary.total)} ({metrics.length} 项)
        </Typography>

        {/* Expandable content with scrolling */}
        <Box sx={{ 
          mt: 2, 
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <TableContainer 
            component={Paper} 
            variant="outlined"
            sx={{ 
              maxHeight: `${maxTableHeight}px`,
              overflow: 'auto',
              flex: 1,
              '&::-webkit-scrollbar': {
                width: '8px',
              },
              '&::-webkit-scrollbar-track': {
                background: theme.palette.grey[100],
                borderRadius: '4px',
              },
              '&::-webkit-scrollbar-thumb': {
                background: theme.palette.grey[400],
                borderRadius: '4px',
                '&:hover': {
                  background: theme.palette.grey[600],
                }
              }
            }}
          >
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ 
                    backgroundColor: theme.palette.background.paper,
                    position: 'sticky',
                    top: 0,
                    zIndex: 1
                  }}>
                    操作
                  </TableCell>
                  <TableCell sx={{ 
                    backgroundColor: theme.palette.background.paper,
                    position: 'sticky',
                    top: 0,
                    zIndex: 1
                  }}>
                    类型
                  </TableCell>
                  <TableCell align="right" sx={{ 
                    backgroundColor: theme.palette.background.paper,
                    position: 'sticky',
                    top: 0,
                    zIndex: 1
                  }}>
                    耗时
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {metrics.map((metric, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                        {metric.name}
                      </Typography>
                      {metric.details && (
                        <Typography variant="caption" sx={{ 
                          color: 'text.secondary', 
                          display: 'block',
                          wordBreak: 'break-word',
                          maxWidth: '200px'
                        }}>
                          {JSON.stringify(metric.details)}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {getCategoryIcon(metric.category)}
                        <Typography variant="caption">
                          {metric.category}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          color: getPerformanceColor(metric.duration || 0),
                          fontWeight: 'bold'
                        }}
                      >
                        {formatDuration(metric.duration || 0)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Legend - fixed at bottom when expanded */}
          <Box sx={{ 
            mt: 1, 
            display: 'flex', 
            gap: 1,
            flexShrink: 0,
            borderTop: `1px solid ${theme.palette.divider}`,
            pt: 1
          }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              🟢 &lt;100ms • 🟡 100ms-1s • 🔴 &gt;1s
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}; 