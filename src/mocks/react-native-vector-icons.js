// Mock implementation for react-native-vector-icons to enable Expo Go compatibility
import React from 'react';
import { Text, StyleSheet } from 'react-native';

// Mock Icon component that displays the icon name as text
const MockIcon = ({ name, size = 24, color = '#000', style, ...props }) => (
  <Text 
    style={[
      styles.mockIcon, 
      { fontSize: size, color }, 
      style
    ]} 
    {...props}
  >
    {name || '●'}
  </Text>
);

// Export different icon sets as the same mock component
export default MockIcon;

// Named exports for different icon families
export const MaterialIcons = MockIcon;
export const MaterialCommunityIcons = MockIcon;
export const FontAwesome = MockIcon;
export const FontAwesome5 = MockIcon;
export const Ionicons = MockIcon;
export const AntDesign = MockIcon;
export const Entypo = MockIcon;
export const EvilIcons = MockIcon;
export const Feather = MockIcon;
export const Foundation = MockIcon;
export const Octicons = MockIcon;
export const SimpleLineIcons = MockIcon;
export const Zocial = MockIcon;

const styles = StyleSheet.create({
  mockIcon: {
    textAlign: 'center',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
});
