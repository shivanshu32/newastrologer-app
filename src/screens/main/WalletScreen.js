import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'https://jyotishcallbackend-2uxrv.ondigitalocean.app/api/v1';

const WalletScreen = () => {
  const [transactions, setTransactions] = useState([]);
  const [walletBalance, setWalletBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const { user } = useAuth();

  useEffect(() => {
    fetchWalletData();
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [activeTab]);

  const fetchWalletData = async () => {
    await Promise.all([
      fetchWalletBalance(),
      fetchTransactions()
    ]);
  };

  const fetchWalletBalance = async () => {
    try {
      const token = await AsyncStorage.getItem('astrologerToken');
      if (!token) {
        console.log('No auth token found');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/wallet/balance`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch wallet balance');
      }

      const data = await response.json();
      console.log('Fetched wallet balance:', data);
      
      if (data.success) {
        setWalletBalance(data.data?.balance || 0);
      }
    } catch (error) {
      console.error('Error fetching wallet balance:', error);
      Alert.alert('Error', 'Failed to fetch wallet balance');
    }
  };

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('astrologerToken');
      if (!token) {
        console.log('No auth token found');
        return;
      }

      // Build query parameters based on active tab
      let queryParams = '';
      if (activeTab === 'earnings') {
        queryParams = '?type=session_payment';
      } else if (activeTab === 'withdrawals') {
        queryParams = '?type=withdrawal';
      }

      const response = await fetch(`${API_BASE_URL}/wallet/transactions${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch transactions');
      }

      const data = await response.json();
      console.log('Fetched transactions:', data);
      
      if (data.success) {
        // Transform backend data to match frontend expectations
        const transformedTransactions = data.data.map(transaction => ({
          id: transaction._id,
          type: getTransactionDisplayType(transaction.type),
          amount: transaction.amount,
          description: transaction.description || getDefaultDescription(transaction.type),
          date: transaction.createdAt,
          status: transaction.status,
        }));
        
        setTransactions(transformedTransactions);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
      Alert.alert('Error', 'Failed to fetch transactions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getTransactionDisplayType = (backendType) => {
    switch (backendType) {
      case 'session_payment':
      case 'commission':
        return 'earning';
      case 'withdrawal':
        return 'withdrawal';
      case 'bonus_credit':
      case 'admin_credit':
        return 'earning';
      case 'admin_debit':
        return 'withdrawal';
      default:
        return 'earning';
    }
  };

  const getDefaultDescription = (type) => {
    switch (type) {
      case 'session_payment':
        return 'Consultation session payment';
      case 'commission':
        return 'Platform commission';
      case 'withdrawal':
        return 'Withdrawal to bank account';
      case 'bonus_credit':
        return 'Bonus credit';
      case 'admin_credit':
        return 'Admin credit adjustment';
      case 'admin_debit':
        return 'Admin debit adjustment';
      default:
        return 'Transaction';
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchWalletData();
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getStatusBadge = (status) => {
    let backgroundColor, textColor, label;
    
    switch (status) {
      case 'completed':
        backgroundColor = '#e6fff0';
        textColor = '#00a854';
        label = 'Completed';
        break;
      case 'processing':
        backgroundColor = '#e6f7ff';
        textColor = '#0070f3';
        label = 'Processing';
        break;
      case 'failed':
        backgroundColor = '#fff1f0';
        textColor = '#f5222d';
        label = 'Failed';
        break;
      default:
        backgroundColor = '#f0f0f0';
        textColor = '#666';
        label = status.charAt(0).toUpperCase() + status.slice(1);
    }
    
    return (
      <View style={[styles.statusBadge, { backgroundColor }]}>
        <Text style={[styles.statusText, { color: textColor }]}>{label}</Text>
      </View>
    );
  };

  const renderTransactionItem = ({ item }) => {
    const isEarning = item.type === 'earning';
    
    return (
      <View style={styles.transactionCard}>
        <View style={styles.transactionHeader}>
          <View style={styles.transactionIcon}>
            <Ionicons
              name={isEarning ? 'arrow-down-circle' : 'arrow-up-circle'}
              size={24}
              color={isEarning ? '#00a854' : '#0070f3'}
            />
          </View>
          <View style={styles.transactionInfo}>
            <Text style={styles.transactionDescription}>{item.description}</Text>
            <Text style={styles.transactionDate}>{formatDate(item.date)}</Text>
          </View>
          <View style={styles.transactionAmount}>
            <Text style={[
              styles.amountText,
              { color: isEarning ? '#00a854' : '#0070f3' }
            ]}>
              {isEarning ? '+' : '-'} ₹{item.amount}
            </Text>
            {getStatusBadge(item.status)}
          </View>
        </View>
      </View>
    );
  };

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="wallet-outline" size={60} color="#ccc" />
      <Text style={styles.emptyText}>No transactions found</Text>
      <Text style={styles.emptySubtext}>
        {activeTab === 'earnings'
          ? 'You have no earnings yet'
          : activeTab === 'withdrawals'
          ? 'You have not made any withdrawals yet'
          : 'Your transaction history is empty'}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Wallet</Text>
      </View>
      
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Available Balance</Text>
        <Text style={styles.balanceAmount}>₹{walletBalance}</Text>
        <TouchableOpacity style={styles.withdrawButton}>
          <Text style={styles.withdrawButtonText}>Withdraw to Bank</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'all' && styles.activeTab]}
          onPress={() => setActiveTab('all')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'all' && styles.activeTabText,
            ]}
          >
            All
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'earnings' && styles.activeTab]}
          onPress={() => setActiveTab('earnings')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'earnings' && styles.activeTabText,
            ]}
          >
            Earnings
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'withdrawals' && styles.activeTab]}
          onPress={() => setActiveTab('withdrawals')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'withdrawals' && styles.activeTabText,
            ]}
          >
            Withdrawals
          </Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.transactionsContainer}>
        <Text style={styles.sectionTitle}>Transaction History</Text>
        
        {loading ? (
          <ActivityIndicator style={styles.loader} size="large" color="#8A2BE2" />
        ) : (
          <FlatList
            data={transactions}
            renderItem={renderTransactionItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.transactionsList}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
              />
            }
            ListEmptyComponent={renderEmptyList}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  header: {
    backgroundColor: '#8A2BE2',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  balanceCard: {
    backgroundColor: '#fff',
    margin: 20,
    marginTop: -10,
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  balanceLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  withdrawButton: {
    backgroundColor: '#8A2BE2',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  withdrawButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#8A2BE2',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
  },
  activeTabText: {
    color: '#8A2BE2',
    fontWeight: 'bold',
  },
  transactionsContainer: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  loader: {
    marginTop: 20,
  },
  transactionsList: {
    paddingBottom: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 50,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  transactionCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  transactionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  transactionIcon: {
    marginRight: 15,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 5,
  },
  transactionDate: {
    fontSize: 12,
    color: '#666',
  },
  transactionAmount: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
});

export default WalletScreen;
