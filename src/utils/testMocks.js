// Test script to verify mock implementations work correctly
import { getWebRTCImports, getVectorIconsImport, getWebRTCService, isExpoGo } from '../config/expoConfig';

export const testMockImplementations = async () => {
  console.log('=== Testing Mock Implementations ===');
  console.log('Running in Expo Go:', isExpoGo);
  
  try {
    // Test WebRTC imports
    console.log('\n--- Testing WebRTC Imports ---');
    const webrtcImports = getWebRTCImports();
    console.log('RTCView available:', !!webrtcImports.RTCView);
    console.log('RTCPeerConnection available:', !!webrtcImports.RTCPeerConnection);
    console.log('mediaDevices available:', !!webrtcImports.mediaDevices);
    
    // Test Vector Icons
    console.log('\n--- Testing Vector Icons ---');
    const MaterialIcons = getVectorIconsImport('MaterialIcons');
    console.log('MaterialIcons component available:', !!MaterialIcons);
    
    // Test WebRTC Service
    console.log('\n--- Testing WebRTC Service ---');
    const WebRTCService = getWebRTCService();
    console.log('WebRTCService available:', !!WebRTCService);
    console.log('WebRTCService.initialize method:', typeof WebRTCService.initialize);
    
    // Test WebRTC Service initialization
    if (WebRTCService && typeof WebRTCService.initialize === 'function') {
      const initResult = await WebRTCService.initialize();
      console.log('WebRTC Service initialization result:', initResult);
    }
    
    // Test media devices
    if (webrtcImports.mediaDevices) {
      console.log('\n--- Testing Media Devices ---');
      try {
        const stream = await webrtcImports.mediaDevices.getUserMedia({ video: true, audio: true });
        console.log('getUserMedia successful, stream ID:', stream?.id);
        
        const devices = await webrtcImports.mediaDevices.enumerateDevices();
        console.log('enumerateDevices returned', devices?.length, 'devices');
      } catch (error) {
        console.log('Media devices test error:', error.message);
      }
    }
    
    console.log('\n=== Mock Implementation Test Complete ===');
    return true;
    
  } catch (error) {
    console.error('Mock implementation test failed:', error);
    return false;
  }
};

// Auto-run test in development
if (__DEV__ && isExpoGo) {
  setTimeout(() => {
    testMockImplementations();
  }, 2000); // Run after app initialization
}
