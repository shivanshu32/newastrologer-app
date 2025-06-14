import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';

const WalletScreen = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const { user } = useAuth();

  useEffect(() => {
    fetchTransactions();
  }, [activeTab]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      
      // In a real app, this would call your backend API
      // const response = await axios.get(`${API_URL}/astrologer/transactions?type=${activeTab}`);
      // setTransactions(response.data);
      
      // Simulate API call with dummy data
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const dummyTransactions = [
        {
          id: '1',
          type: 'earning',
          amount: 500,
          description: 'Chat consultation with Rahul Sharma',
          date: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
          status: 'completed',
        },
        {
          id: '2',
          type: 'earning',
          amount: 750,
          description: 'Video consultation with Priya Patel',
          date: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
          status: 'completed',
        },
        {
          id: '3',
          type: 'withdrawal',
          amount: 1000,
          description: 'Withdrawal to bank account',
          date: new Date(Date.now() - 259200000).toISOString(), // 3 days ago
          status: 'processing',
        },
        {
          id: '4',
          type: 'earning',
          amount: 400,
          description: 'Chat consultation with Amit Kumar',
          date: new Date(Date.now() - 345600000).toISOString(), // 4 days ago
          status: 'completed',
        },
        {
          id: '5',
          type: 'withdrawal',
          amount: 800,
          description: 'Withdrawal to bank account',
          date: new Date(Date.now() - 432000000).toISOString(), // 5 days ago
          status: 'completed',
        },
      ];
      
      // Filter transactions based on active tab
      let filteredTransactions = dummyTransactions;
      if (activeTab === 'earnings') {
        filteredTransactions = dummyTransactions.filter(t => t.type === 'earning');
      } else if (activeTab === 'withdrawals') {
        filteredTransactions = dummyTransactions.filter(t => t.type === 'withdrawal');
      }
      
      setTransactions(filteredTransactions);
      setLoading(false);
    } catch (error) {
      console.log('Error fetching transactions:', error);
      setLoading(false);
    }
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
        <Text style={styles.balanceAmount}>₹{user?.walletBalance || 0}</Text>
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
