import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const BasicVideoScreen = () => {
  console.log('[ASTROLOGER-APP] BasicVideoScreen mounted - NO CONTEXT, NO HOOKS');
  
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Basic Video Screen</Text>
      <Text style={styles.text}>No Context, No Hooks, Just Basic React</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  text: {
    color: '#fff',
    fontSize: 18,
    marginBottom: 10,
    textAlign: 'center',
  },
});

export default BasicVideoScreen;
