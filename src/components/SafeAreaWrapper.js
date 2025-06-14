import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// This is a wrapper component to handle the SafeAreaProvider issues in SDK 53
export default function SafeAreaWrapper({ children }) {
  // Create a custom provider that doesn't rely on updateStatus
  return (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 0, height: 0 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 }
      }}
    >
      {children}
    </SafeAreaProvider>
  );
}
