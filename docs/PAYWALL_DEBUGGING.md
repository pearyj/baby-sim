# Paywall Debugging Guide

This document explains how to debug paywall issues in production using the built-in debugging tools.

## 🔗 Secret Test Links

### 1. Secret Test Ending
Access the test ending directly in production:
```
https://your-production-url.com/?secretTestEnding=yes
```

This will:
- Show the "🔍 Secret Test Ending (Production Debug)" button on the welcome screen
- Allow you to trigger the test ending with full paywall integration
- Enable all debug test buttons (Ad Test, Payment Test)

### 2. Skip Paywall (Emergency Bypass)
Completely bypass the paywall system:
```
https://your-production-url.com/?skipPaywall=yes
```

This will:
- Return 999 credits for any credit check
- Allow unlimited image generation
- Useful for emergency situations or testing non-paywall features

### 3. Combined Parameters
You can combine parameters:
```
https://your-production-url.com/?secretTestEnding=yes&skipPaywall=yes
```

## 🔍 Console Logging

All paywall debugging uses `console.warn()` which is preserved in production builds. Look for logs prefixed with:
```
🔍 PAYWALL DEBUG -
```

### Key Log Categories

#### 1. App-Level Logs
- **Configuration**: Paywall version, environment, feature flags
- **Game State**: Current game phase, ending state, child data
- **Secret Parameters**: When secret test links are used

#### 2. PaywallGate Component Logs
- **Initialization**: Component setup, props received
- **Credit Checks**: Current credits, email status, requirements
- **Generation Flow**: Image generation attempts, gate decisions
- **State Changes**: Payment store updates, paywall visibility

#### 3. Payment Store Logs
- **Anonymous ID**: Generation and initialization
- **Credit Operations**: Fetch, consume, update operations
- **API Calls**: Checkout session creation, error handling
- **Email Management**: Email setting and validation

#### 4. AIImageGenerator Logs
- **Props**: Received paywall props (hasCredits, onBeforeGenerate)
- **Generation Flow**: Button clicks, gate checks, API calls
- **Results**: Success/failure of image generation

#### 5. Backend API Logs
- **Credits API**: Database queries, email lookups, credit calculations
- **Consume Credit API**: Balance checks, credit deduction
- **Environment**: Table selection, Supabase operations

## 🛠 Debugging Workflow

### Step 1: Access Secret Test Link
1. Navigate to: `https://your-production-url.com/?secretTestEnding=yes`
2. Check console for: `🔍 PAYWALL DEBUG - Configuration:`
3. Click "🔍 Secret Test Ending (Production Debug)"

### Step 2: Monitor Console Logs
Open browser DevTools and filter console for: `🔍 PAYWALL DEBUG`

### Step 3: Test Paywall Flow
1. **Check Initial State**:
   - Look for PaywallGate initialization logs
   - Verify anonymous ID generation
   - Check initial credit fetch

2. **Test Image Generation**:
   - Click the image generation button
   - Monitor gate decision logs
   - Check if paywall opens or generation proceeds

3. **Test Payment Flow** (if needed):
   - Navigate to: `https://your-production-url.com/payment-test-page?secretTestEnding=yes`
   - Test credit purchase and consumption

### Step 4: Analyze Issues

#### Common Issues and Log Patterns:

**Issue: Free generation allowed when it shouldn't be**
Look for:
```
🔍 PAYWALL DEBUG - PaywallGate: Credits not required, allowing generation
🔍 PAYWALL DEBUG - PaywallGate: Credits available, allowing generation
```

**Issue: Paywall not showing when it should**
Look for:
```
🔍 PAYWALL DEBUG - PaywallGate: No email, showing paywall
🔍 PAYWALL DEBUG - PaywallGate: No credits, showing paywall
```

**Issue: Credits not updating**
Look for:
```
🔍 PAYWALL DEBUG - Credits API called:
🔍 PAYWALL DEBUG - DB credits total:
🔍 PAYWALL DEBUG - Final credits response:
```

**Issue: Environment/Configuration problems**
Look for:
```
🔍 PAYWALL DEBUG - Configuration:
🔍 PAYWALL DEBUG - Querying table:
```

## 🔧 Environment Variables

Check these in production:

##️ Frontend (Browser)
- `VITE_PAYWALL_VERSION`: Should be "prod" for production
- `VITE_STRIPE_PUBLISHABLE_KEY`: Stripe public key

### Backend (Server)
- `PAYWALL_VERSION`: Should match frontend version
- `CREDITS_TABLE`: Database table name
- `VERCEL_ENV`: Environment identifier

## 🚨 Emergency Procedures

### Disable Paywall Completely
Set environment variable:
```
VITE_PAYWALL_VERSION=off
```

### Emergency Bypass Link
Share this link with affected users:
```
https://your-production-url.com/?skipPaywall=yes
```

### Reset User Credits (Backend)
Use the payment test page:
```
https://your-production-url.com/payment-test-page?secretTestEnding=yes
```

## 📊 Log Analysis Examples

### Normal Working Flow:
```
🔍 PAYWALL DEBUG - Configuration: {paywallVersion: "prod", skipPaywall: false}
🔍 PAYWALL DEBUG - PaywallGate initialized: {requiresCredits: true}
🔍 PAYWALL DEBUG - PaymentStore: initializeAnonymousId: "abc12345"
🔍 PAYWALL DEBUG - PaymentStore: fetchCredits called: {anonId: "abc12345"}
🔍 PAYWALL DEBUG - Credits API called: {method: "GET"}
🔍 PAYWALL DEBUG - Final credits response: {credits: 0}
🔍 PAYWALL DEBUG - AIImageGenerator: handleGenerateImage called
🔍 PAYWALL DEBUG - PaywallGate: No credits, showing paywall
```

### Problem Flow (Free Generation):
```
🔍 PAYWALL DEBUG - Configuration: {paywallVersion: "test", skipPaywall: false}
🔍 PAYWALL DEBUG - PaywallGate: Credits not required, allowing generation
🔍 PAYWALL DEBUG - AIImageGenerator: proceeding with image generation
```

This indicates the paywall version is set to "test" instead of "prod".

## 🔄 Cleanup

After debugging, remember to:
1. Remove secret URL parameters from browser history
2. Clear any test data from localStorage if needed
3. Verify normal user flow works without parameters 