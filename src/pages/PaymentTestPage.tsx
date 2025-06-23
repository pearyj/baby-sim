/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Alert,
  Divider,
  Paper,
  List,
  ListItem,
  ListItemText,
  Chip,
  Switch,
  FormControlLabel,
} from '@mui/material';
import Grid from '@mui/material/GridLegacy';
import { styled } from '@mui/material/styles';
import {
  CreditCard,
  AccountBalance,
  BugReport,
  Refresh,
  Delete,
  Image as ImageIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { usePaymentStore } from '../stores/usePaymentStore';
import { PaywallGate } from '../components/payment';
import { AIImageGenerator } from '../components/AIImageGenerator';
import type { GameState } from '../types/game';

const TestContainer = styled(Box)(({ theme }) => ({
  minHeight: '100vh',
  backgroundColor: '#f5f5f5',
  padding: theme.spacing(3),
}));

const TestCard = styled(Card)(({ theme }) => ({
  marginBottom: theme.spacing(2),
  '& .MuiCardContent-root': {
    padding: theme.spacing(3),
  },
}));

const StatusChip = styled(Chip)<{ status: 'success' | 'error' | 'warning' | 'info' }>(({ theme, status }) => ({
  fontWeight: 'bold',
  ...(status === 'success' && {
    backgroundColor: '#4CAF50',
    color: 'white',
  }),
  ...(status === 'error' && {
    backgroundColor: '#f44336',
    color: 'white',
  }),
  ...(status === 'warning' && {
    backgroundColor: '#ff9800',
    color: 'white',
  }),
  ...(status === 'info' && {
    backgroundColor: '#2196f3',
    color: 'white',
  }),
}));

// Mock game state for testing
const mockGameState: GameState = {
  player: { gender: 'female', age: 30 },
  child: { name: 'Emma', gender: 'female', age: 3 },
  history: [],
  finance: 5,
  marital: 5,
  isSingleParent: false,
  playerDescription: 'Test player description',
  childDescription: 'Test child description', 
  currentQuestion: null,
  feedbackText: null,
  endingSummaryText: 'Test ending summary',
};

export const PaymentTestPage: React.FC = () => {
  const { i18n } = useTranslation();
  const {
    anonId,
    credits,
    isLoading,
    error,
    initializeAnonymousId,
    fetchCredits,
    createCheckoutSession,
    consumeCredit,
    resetError,
  } = usePaymentStore();

  const [testEmail, setTestEmail] = useState('test@example.com');
  const [testDonationUnits, setTestDonationUnits] = useState(1);
  const [testLog, setTestLog] = useState<string[]>([]);
  const [showPaywallTest, setShowPaywallTest] = useState(false);

  useEffect(() => {
    if (!anonId) {
      initializeAnonymousId();
    }
  }, [anonId, initializeAnonymousId]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setTestLog(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 19)]);
  };

  const handleFetchCredits = async () => {
    addLog('Fetching credits...');
    try {
      await fetchCredits(testEmail);
      addLog(`✅ Credits fetched: ${credits}`);
    } catch (error) {
      addLog(`❌ Error fetching credits: ${error}`);
    }
  };

  const handleCreateCheckout = async () => {
    addLog(`Creating checkout session for ${testDonationUnits} units...`);
    try {
      const result = await createCheckoutSession({
        email: testEmail,
        lang: i18n.language,
        donatedUnits: testDonationUnits,
      });
      
      if (result.success) {
        addLog(`✅ Checkout session created: ${result.sessionId}`);
        if (result.url) {
          addLog(`🔗 Redirect URL: ${result.url}`);
          // For testing, we'll just log the URL instead of redirecting
          if (import.meta.env.DEV) {
          console.log('Stripe Checkout URL:', result.url);
        }
        }
      } else {
        addLog(`❌ Checkout failed: ${result.error}`);
      }
    } catch (error) {
      addLog(`❌ Error creating checkout: ${error}`);
    }
  };

  const handleConsumeCredit = async () => {
    const success = await consumeCredit();
    addLog(success ? '✅ Credit consumed successfully' : '❌ No credits to consume');
  };

  const handleResetData = () => {
    localStorage.clear();
    window.location.reload();
  };

  const getPaywallStatus = () => {
    const version = import.meta.env.VITE_PAYWALL_VERSION || 'test';
    const hasCredits = credits > 0;
    
    if (version === 'off') return { status: 'info' as const, text: 'Disabled' };
    if (version === 'test') return { status: 'warning' as const, text: 'Test Mode' };
    if (hasCredits) return { status: 'success' as const, text: 'Active with Credits' };
    return { status: 'error' as const, text: 'Active - No Credits' };
  };

  const paywallStatus = getPaywallStatus();

  return (
    <TestContainer>
      <Typography variant="h4" sx={{ mb: 3, fontWeight: 600 }}>
        🧪 Payment System Test Page
      </Typography>

      <Grid container spacing={3}>
        {/* Status Overview */}
        <Grid item xs={12} md={6}>
          <TestCard>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                📊 System Status
              </Typography>
              
              <List dense>
                <ListItem>
                  <ListItemText primary="Anonymous ID" />
                  <Chip label={anonId?.slice(-8) || 'Not Set'} size="small" />
                </ListItem>
                <ListItem>
                  <ListItemText primary="Credits" />
                  <StatusChip 
                    status={credits > 0 ? 'success' : 'error'} 
                    label={credits.toString()}
                    size="small"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText primary="Paywall Status" />
                  <StatusChip 
                    status={paywallStatus.status}
                    label={paywallStatus.text}
                    size="small"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText primary="Loading" />
                  <StatusChip 
                    status={isLoading ? 'warning' : 'success'}
                    label={isLoading ? 'Yes' : 'No'}
                    size="small"
                  />
                </ListItem>
              </List>

              {error && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {error}
                  <Button onClick={resetError} size="small" sx={{ ml: 1 }}>
                    Clear
                  </Button>
                </Alert>
              )}
            </CardContent>
          </TestCard>
        </Grid>

        {/* Test Controls */}
        <Grid item xs={12} md={6}>
          <TestCard>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                🎮 Test Controls
              </Typography>

              <TextField
                fullWidth
                label="Test Email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                sx={{ mb: 2 }}
                size="small"
              />

              <TextField
                fullWidth
                label="Donation Units"
                type="number"
                value={testDonationUnits}
                onChange={(e) => setTestDonationUnits(parseInt(e.target.value) || 1)}
                inputProps={{ min: 1, max: 10 }}
                sx={{ mb: 2 }}
                size="small"
              />

              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <Button
                    fullWidth
                    variant="outlined"
                    onClick={handleFetchCredits}
                    startIcon={<Refresh />}
                    disabled={isLoading}
                    size="small"
                  >
                    Fetch Credits
                  </Button>
                </Grid>
                <Grid item xs={6}>
                  <Button
                    fullWidth
                    variant="outlined"
                    onClick={handleConsumeCredit}
                    startIcon={<AccountBalance />}
                    size="small"
                  >
                    Use Credit
                  </Button>
                </Grid>
                <Grid item xs={12}>
                  <Button
                    fullWidth
                    variant="contained"
                    onClick={handleCreateCheckout}
                    startIcon={<CreditCard />}
                    disabled={isLoading}
                    sx={{ mt: 1 }}
                  >
                    Test Stripe Checkout
                  </Button>
                </Grid>
                <Grid item xs={6}>
                  <Button
                    fullWidth
                    variant="outlined"
                    color="error"
                    onClick={handleResetData}
                    startIcon={<Delete />}
                    size="small"
                    sx={{ mt: 1 }}
                  >
                    Reset Data
                  </Button>
                </Grid>
                <Grid item xs={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={showPaywallTest}
                        onChange={(e) => setShowPaywallTest(e.target.checked)}
                        size="small"
                      />
                    }
                    label="Paywall Test"
                    sx={{ mt: 1 }}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </TestCard>
        </Grid>

        {/* Paywall Integration Test */}
        {showPaywallTest && (
          <Grid item xs={12}>
            <TestCard>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  🚧 Paywall Integration Test
                </Typography>
                
                <Alert severity="info" sx={{ mb: 2 }}>
                  This tests the PaywallGate component wrapping the AIImageGenerator.
                  Try generating an image with and without credits.
                </Alert>
                
                <PaywallGate 
                  childName={mockGameState.child.name}
                  onCreditConsumed={() => addLog('🎯 Credit consumed by PaywallGate')}
                >
                  <AIImageGenerator
                    gameState={mockGameState}
                    endingSummary="Test ending summary for AI image generation testing."
                    onImageGenerated={(result) => {
                      addLog(`🖼️ Image generated: ${result.success ? 'Success' : 'Failed'}`);
                    }}
                  />
                </PaywallGate>
              </CardContent>
            </TestCard>
          </Grid>
        )}

        {/* Test Log */}
        <Grid item xs={12}>
          <TestCard>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                📝 Test Log
              </Typography>
              
              <Paper 
                sx={{ 
                  height: 300, 
                  overflow: 'auto', 
                  p: 2, 
                  backgroundColor: '#1e1e1e',
                  color: '#00ff00',
                  fontFamily: 'monospace',
                  fontSize: '0.8rem'
                }}
              >
                {testLog.length === 0 ? (
                  <Typography sx={{ color: '#666' }}>
                    Test log will appear here...
                  </Typography>
                ) : (
                  testLog.map((log, index) => (
                    <div key={index}>{log}</div>
                  ))
                )}
              </Paper>
              
              <Button 
                onClick={() => setTestLog([])}
                size="small"
                sx={{ mt: 1 }}
              >
                Clear Log
              </Button>
            </CardContent>
          </TestCard>
        </Grid>
      </Grid>

      {/* Testing Instructions */}
      <TestCard>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            📋 Testing Instructions for Slice 1
          </Typography>
          
          <Typography variant="body2" component="div">
            <strong>1. Basic Credit System:</strong>
            <ul>
              <li>Check that an anonymous ID is generated automatically</li>
              <li>Test fetching credits (should start at 0)</li>
              <li>Test consuming credits (should fail when 0)</li>
            </ul>
            
            <strong>2. Stripe Checkout:</strong>
            <ul>
              <li>Click "Test Stripe Checkout" to create a session</li>
              <li>Check the browser console for the checkout URL</li>
              <li>In a real test, you would be redirected to Stripe</li>
            </ul>
            
            <strong>3. Paywall Integration:</strong>
            <ul>
              <li>Enable "Paywall Test" to see the integrated experience</li>
              <li>Try generating an image without credits (should show paywall)</li>
              <li>Add credits and try again (should allow generation)</li>
            </ul>
            
            <strong>4. Feature Flags:</strong>
            <ul>
              <li>Test with <code>?skipPaywall=yes</code> URL parameter</li>
              <li>Set <code>VITE_PAYWALL_VERSION=off</code> to disable paywall</li>
            </ul>
          </Typography>
        </CardContent>
      </TestCard>
    </TestContainer>
  );
}; 