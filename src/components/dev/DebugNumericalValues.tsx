import React from 'react';
import { Box, Typography, Paper, Chip } from '@mui/material';
import { styled } from '@mui/material/styles';
import useGameStore from '../../stores/useGameStore';
import { usePaymentStore } from '../../stores/usePaymentStore';

const DebugPanel = styled(Paper)(({ theme }) => ({
  position: 'fixed',
  top: 80, // Below the header
  right: 16,
  zIndex: 1000,
  padding: theme.spacing(1.5),
  backgroundColor: 'rgba(0, 0, 0, 0.85)',
  color: 'white',
  minWidth: 200,
  fontFamily: 'monospace',
  fontSize: '0.875rem',
  border: '1px solid rgba(255, 255, 255, 0.2)',
}));

const ValueRow = styled(Box)({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 8,
});

const getFinanceStatus = (finance: number) => {
  if (finance <= 0) return { text: 'BANKRUPTCY', color: 'error' };
  if (finance <= 2) return { text: 'Poor', color: 'warning' };
  if (finance <= 4) return { text: 'Struggling', color: 'warning' };
  if (finance <= 6) return { text: 'Middle', color: 'info' };
  if (finance <= 8) return { text: 'Wealthy', color: 'success' };
  return { text: 'Very Wealthy', color: 'success' };
};

const getMaritalStatus = (marital: number) => {
  if (marital <= 0) return { text: 'PARTNER LEFT', color: 'error' };
  if (marital <= 2) return { text: 'Crisis', color: 'error' };
  if (marital <= 4) return { text: 'Strained', color: 'warning' };
  if (marital <= 6) return { text: 'Stable', color: 'info' };
  if (marital <= 8) return { text: 'Good', color: 'success' };
  return { text: 'Excellent', color: 'success' };
};

export const DebugNumericalValues: React.FC = () => {
  const { finance, marital, isSingleParent, currentAge, gamePhase, currentQuestion, player } = useGameStore(state => ({
    finance: state.finance,
    marital: state.marital,
    isSingleParent: state.isSingleParent,
    currentAge: state.currentAge,
    gamePhase: state.gamePhase,
    currentQuestion: state.currentQuestion,
    player: state.player,
  }));

  const { credits } = usePaymentStore(state => ({ credits: state.credits }));

  // Track changes
  const prevValues = React.useRef({ finance: -1, marital: -1 });

  // Debug logging to console with localStorage check (development only)
  React.useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('🐛 Debug Component Values:', {
        finance,
        marital,
        isSingleParent,
        currentAge,
        gamePhase,
        hasPlayer: !!player,
        timestamp: new Date().toISOString()
      });
      
      if (prevValues.current.finance !== finance || prevValues.current.marital !== marital) {
        if (prevValues.current.finance !== -1) { // Not first load
          console.log('🔄 VALUE CHANGE DETECTED:');
          console.log(`  Finance: ${prevValues.current.finance} → ${finance} (Δ${finance - prevValues.current.finance})`);
          console.log(`  Marital: ${prevValues.current.marital} → ${marital} (Δ${marital - prevValues.current.marital})`);
        }
      }
      
      // Also check what's in localStorage
      try {
        const stored = localStorage.getItem('childSimGameState');
        if (stored) {
          const parsed = JSON.parse(stored);
          console.log('💾 LocalStorage values:', {
            finance: parsed.data?.finance,
            marital: parsed.data?.marital,
            isSingleParent: parsed.data?.isSingleParent,
            currentAge: parsed.data?.currentAge,
            hasFinance: typeof parsed.data?.finance === 'number',
            hasMarital: typeof parsed.data?.marital === 'number',
            hasIsSingleParent: typeof parsed.data?.isSingleParent === 'boolean',
            hasCurrentAge: typeof parsed.data?.currentAge === 'number'
          });
        } else {
          console.log('💾 No localStorage data found');
        }
      } catch (e) {
        console.log('💾 Error reading localStorage:', e);
      }
    }
    
    // Always update prevValues regardless of environment for component logic
    if (prevValues.current.finance !== finance || prevValues.current.marital !== marital) {
      prevValues.current = { finance, marital };
    }
  }, [finance, marital, isSingleParent, currentAge, gamePhase, player]);

  // Only show when the game has been properly initialized with actual values
  // This means: not in early phases AND has a player (meaning game is initialized)
  if (!player || gamePhase === 'uninitialized' || gamePhase === 'welcome' || gamePhase === 'initialization_failed' || gamePhase === 'initializing') {
    return null;
  }

  const financeStatus = getFinanceStatus(finance);
  const maritalStatus = getMaritalStatus(marital);

  return (
    <DebugPanel elevation={8}>
      <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 1, display: 'block' }}>
        DEBUG VALUES ({gamePhase})
      </Typography>
      
      <ValueRow>
        <Typography variant="body2" sx={{ color: 'white', fontWeight: 'bold' }}>
          Finance:
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" sx={{ color: 'white', fontFamily: 'monospace' }}>
            {finance}/10
          </Typography>
          <Chip 
            label={financeStatus.text} 
            color={financeStatus.color as any}
            size="small"
            sx={{ fontSize: '0.7rem', height: 20 }}
          />
        </Box>
      </ValueRow>

      <ValueRow>
        <Typography variant="body2" sx={{ color: 'white', fontWeight: 'bold' }}>
          Marital:
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" sx={{ color: 'white', fontFamily: 'monospace' }}>
            {marital}/10 ({isSingleParent ? 'Single Parent' : 'Married'})
          </Typography>
          <Chip 
            label={maritalStatus.text} 
            color={maritalStatus.color as any}
            size="small"
            sx={{ fontSize: '0.7rem', height: 20 }}
          />
        </Box>
      </ValueRow>

      <ValueRow>
        <Typography variant="body2" sx={{ color: 'white', fontWeight: 'bold' }}>
          Credits:
        </Typography>
        <Typography variant="body2" sx={{ color: 'white', fontFamily: 'monospace' }}>
          {credits}
        </Typography>
      </ValueRow>

      {currentQuestion && (
        <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid rgba(255, 255, 255, 0.2)' }}>
          <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.7)', display: 'block' }}>
            Current Options Deltas:
          </Typography>
          {currentQuestion.options.map(opt => (
            <Typography key={opt.id} variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.6)', display: 'block', fontSize: '0.7rem' }}>
              {opt.id}: F{opt.financeDelta || (opt.cost ? -opt.cost : 0)} M{opt.maritalDelta || 0}
            </Typography>
          ))}
        </Box>
      )}

      <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)', mt: 1, display: 'block' }}>
        Crisis: Finance ≤ 0 OR Marital ≤ 0
      </Typography>
    </DebugPanel>
  );
}; 