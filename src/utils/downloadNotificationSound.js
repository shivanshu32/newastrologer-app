import * as FileSystem from 'expo-file-system';

/**
 * Downloads a notification sound file from a URL and saves it to the app's file system
 * This is a utility script that can be run during development to download a notification sound
 */

// URL of a free notification sound (replace with your desired sound URL)
const NOTIFICATION_SOUND_URL = 'https://notificationsounds.com/storage/sounds/file-sounds-1150-pristine.mp3';

// Local file path where the sound will be saved
const LOCAL_SOUND_PATH = FileSystem.documentDirectory + 'notification.mp3';

/**
 * Downloads the notification sound file
 */
const downloadNotificationSound = async () => {
  try {
    console.log('🔽 Downloading notification sound...');
    
    // Download the file
    const downloadResult = await FileSystem.downloadAsync(
      NOTIFICATION_SOUND_URL,
      LOCAL_SOUND_PATH
    );
    
    if (downloadResult.status === 200) {
      console.log('✅ Notification sound downloaded successfully!');
      console.log('📂 File saved at:', LOCAL_SOUND_PATH);
      return LOCAL_SOUND_PATH;
    } else {
      console.error('❌ Failed to download notification sound:', downloadResult);
      return null;
    }
  } catch (error) {
    console.error('❌ Error downloading notification sound:', error);
    return null;
  }
};

// Execute the download function
downloadNotificationSound().then((path) => {
  if (path) {
    console.log('🔊 You can now use this sound in your app');
    console.log('📝 Update your code to use this path:', path);
  } else {
    console.log('❌ Failed to download notification sound');
  }
});

export default downloadNotificationSound;
