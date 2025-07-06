// Device detection utilities

/**
 * Detects if the user is on a mobile device
 * @returns true if on mobile device, false otherwise
 */
export function isMobileDevice(): boolean {
  // Check for mobile user agent patterns
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
  const userAgent = navigator.userAgent;
  
  // Check user agent
  if (mobileRegex.test(userAgent)) {
    return true;
  }
  
  // Check for touch capability and small screen size
  const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const hasSmallScreen = window.innerWidth <= 768;
  
  return hasTouchScreen && hasSmallScreen;
}

/**
 * Detects if the user is on iOS
 * @returns true if on iOS device, false otherwise
 */
export function isIOSDevice(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

/**
 * Detects if Apple Pay is likely supported
 * @returns true if Apple Pay might be supported, false otherwise
 */
export function isApplePaySupported(): boolean {
  // Apple Pay is supported on iOS devices with Safari or in-app browsers
  // and on macOS with Safari
  if (isIOSDevice()) {
    return true;
  }
  
  // Check for macOS Safari
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const isMac = /Macintosh|MacIntel|MacPPC|Mac68K/.test(navigator.platform);
  
  return isSafari && isMac;
} 