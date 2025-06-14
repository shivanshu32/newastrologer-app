import * as Notifications from 'expo-notifications';

/**
 * Utility functions to test different types of push notifications in the AstrologerApp
 */

/**
 * Send a test notification for a new booking
 */
export const sendNewBookingNotification = async () => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'New Booking Request',
        body: 'Rahul Sharma has requested a consultation with you',
        data: { 
          type: 'new_booking',
          bookingId: '12345',
          userId: '101',
          userName: 'Rahul Sharma'
        },
      },
      trigger: { seconds: 2 },
    });
    return { success: true };
  } catch (error) {
    console.log('Error sending new booking notification:', error);
    return { success: false, message: error.message };
  }
};

/**
 * Send a test notification for a session reminder
 */
export const sendSessionReminderNotification = async () => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Upcoming Session Reminder',
        body: 'Your consultation with Rahul Sharma starts in 15 minutes',
        data: { 
          type: 'session_reminder',
          bookingId: '12345',
          userId: '101',
          userName: 'Rahul Sharma',
          startTime: new Date(Date.now() + 15 * 60 * 1000).toISOString()
        },
      },
      trigger: { seconds: 2 },
    });
    return { success: true };
  } catch (error) {
    console.log('Error sending session reminder notification:', error);
    return { success: false, message: error.message };
  }
};

/**
 * Send a test notification for a payment received
 */
export const sendPaymentReceivedNotification = async () => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Payment Received',
        body: 'You received ₹500 for your consultation with Rahul Sharma',
        data: { 
          type: 'payment_received',
          amount: 500,
          userId: '101',
          userName: 'Rahul Sharma',
          transactionId: 'TXN123456'
        },
      },
      trigger: { seconds: 2 },
    });
    return { success: true };
  } catch (error) {
    console.log('Error sending payment received notification:', error);
    return { success: false, message: error.message };
  }
};

/**
 * Send a test notification for a new rating
 */
export const sendNewRatingNotification = async () => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'New Rating Received',
        body: 'Rahul Sharma gave you a 5-star rating',
        data: { 
          type: 'new_rating',
          rating: 5,
          userId: '101',
          userName: 'Rahul Sharma',
          bookingId: '12345'
        },
      },
      trigger: { seconds: 2 },
    });
    return { success: true };
  } catch (error) {
    console.log('Error sending new rating notification:', error);
    return { success: false, message: error.message };
  }
};

/**
 * Run all notification tests in sequence
 */
export const runAllNotificationTests = async () => {
  const results = [];
  
  // Test new booking notification
  const newBookingResult = await sendNewBookingNotification();
  results.push({ type: 'new_booking', ...newBookingResult });
  
  // Wait 3 seconds between notifications
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Test session reminder notification
  const sessionReminderResult = await sendSessionReminderNotification();
  results.push({ type: 'session_reminder', ...sessionReminderResult });
  
  // Wait 3 seconds between notifications
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Test payment received notification
  const paymentReceivedResult = await sendPaymentReceivedNotification();
  results.push({ type: 'payment_received', ...paymentReceivedResult });
  
  // Wait 3 seconds between notifications
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Test new rating notification
  const newRatingResult = await sendNewRatingNotification();
  results.push({ type: 'new_rating', ...newRatingResult });
  
  return results;
};
