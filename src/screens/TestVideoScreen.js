import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const TestVideoScreen = ({ route, navigation }) => {
  console.log('[ASTROLOGER-APP] TestVideoScreen mounted');
  console.log('[ASTROLOGER-APP] Route params:', JSON.stringify(route?.params || {}));
  
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Test Video Screen</Text>
      <Text style={styles.text}>This is a simple test component</Text>
      {route?.params && (
        <Text style={styles.params}>
          Params: {JSON.stringify(route.params, null, 2)}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    padding: 20,
  },
  text: {
    color: '#fff',
    fontSize: 18,
    marginBottom: 10,
    textAlign: 'center',
  },
  params: {
    color: '#fff',
    fontSize: 12,
    marginTop: 20,
    textAlign: 'left',
  },
});

export default TestVideoScreen;
