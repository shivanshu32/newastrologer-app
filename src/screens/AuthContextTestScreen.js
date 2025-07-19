import React, { useContext } from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { AuthContext } from '../context/AuthContext';

const AuthContextTestScreen = ({ route, navigation }) => {
  console.log('[ASTROLOGER-APP] AuthContextTestScreen mounted - TESTING AUTH CONTEXT ONLY');
  
  // Test ONLY AuthContext usage
  const { user } = useContext(AuthContext);
  
  console.log('[ASTROLOGER-APP] User available:', !!user);
  
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
      <Text style={styles.text}>Auth Context Test Screen</Text>
      <Text style={styles.text}>Testing ONLY AuthContext</Text>
      <Text style={styles.status}>User: {user ? '✅ Available' : '❌ Not Available'}</Text>
      {route?.params && (
        <Text style={styles.info}>
          Route params received: ✅
        </Text>
      )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000',
  },
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
  status: {
    color: '#4CAF50',
    fontSize: 14,
    marginBottom: 8,
    textAlign: 'center',
  },
  info: {
    color: '#fff',
    fontSize: 14,
    marginTop: 20,
    textAlign: 'center',
  },
});

export default AuthContextTestScreen;
