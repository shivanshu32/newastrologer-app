# Notification Sound Setup

To complete the notification sound setup for the astrologer app, you need to add a notification sound file to the assets/sounds directory.

## Steps to Add Notification Sound

1. Create an MP3 file named `notification.mp3` (a short notification sound, ideally 1-3 seconds)
2. Place this file in the `assets/sounds` directory of the astrologer app
3. The app will automatically use this sound for booking request notifications

## Alternative Method

If you prefer to use a different sound file or name:

1. Update the path in `src/utils/notificationUtils.js` to point to your sound file
2. Make sure the file is properly imported and accessible

## Testing Notification Sound

To test the notification sound:

1. Make sure the app has the necessary permissions (microphone, etc.)
2. Use the notification tester utility or trigger a test notification
3. Verify that the sound plays correctly when a booking request is received

## Troubleshooting

If the notification sound doesn't play:

1. Check that the sound file exists in the correct location
2. Verify that the device is not in silent mode
3. Check that the app has the necessary permissions
4. Look for any errors in the console logs related to sound playback
