# Astrologer App - Jyotish Call

This is the Astrologer side of the Jyotish Call platform, a consultation application that connects users with astrologers for chat, voice, and video consultations.

## Features

- **Authentication**: OTP-based login system
- **Home Dashboard**: View earnings, rating, and pending booking requests
- **Bookings Management**: Accept/reject bookings, view upcoming/completed/cancelled sessions
- **Availability Management**: Set weekly availability schedule
- **Session Handling**: Real-time chat and video call interfaces with timer
- **Wallet & Transactions**: View earnings and transaction history
- **Profile Management**: Update profile, manage availability, account settings
- **Push Notifications**: Receive alerts for new bookings, session reminders, payments, and ratings

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Expo CLI

### Installation

1. Clone the repository
2. Navigate to the astrologer-app directory
3. Install dependencies:

```bash
npm install
# or
yarn install
```

### Running the App

```bash
npx expo start
```

This will start the Expo development server. You can run the app on:
- iOS Simulator (requires macOS and Xcode)
- Android Emulator (requires Android Studio)
- Physical device using Expo Go app (scan QR code)

## Testing Push Notifications

The app includes a built-in notification testing system accessible from the Profile screen. You can test different types of notifications:

1. Navigate to the Profile screen
2. Scroll down to the "Notification Testing" section
3. Choose from the following test options:
   - Test Basic Notification
   - Test New Booking
   - Test Session Reminder
   - Test Payment Received
   - Test New Rating
   - Run All Tests (sends all notification types in sequence)

Note: Push notifications require a physical device for full functionality. Simulators/emulators may show local notifications but not push notifications.

## Backend Integration

The app is designed to work with the Jyotish Call backend. To connect to your backend:

1. Update the API base URL in `src/config/api.js`
2. Uncomment API calls in the relevant files
3. Replace placeholder Expo push notification configuration with your own

## Building for Production

To create a production build:

```bash
# For Android
expo build:android

# For iOS
expo build:ios
```

## Project Structure

- `/src/components` - Reusable UI components
- `/src/context` - React Context providers (Auth, Notification)
- `/src/navigation` - Navigation configuration
- `/src/screens` - App screens organized by feature
- `/src/utils` - Utility functions and helpers
- `/assets` - Images, fonts, and other static assets

## Technologies Used

- React Native / Expo
- React Navigation
- Expo Notifications
- WebRTC (for video calls)
- Socket.IO (for real-time communication)
