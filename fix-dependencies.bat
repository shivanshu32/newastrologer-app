@echo off
echo ===== React Native Android Dependencies Fix Script =====
echo.

echo Step 1: Ensuring correct SDK path in local.properties
echo sdk.dir=C:\\Users\\shubh\\AppData\\Local\\Android\\Sdk > android\local.properties
echo.

echo Step 2: Cleaning Android build files
cd android
call gradlew.bat clean
cd ..
echo.

echo Step 3: Checking for React Native link issues
call npx react-native-asset
echo.

echo Step 4: Jetifier fix for AndroidX compatibility
call npx jetifier
echo.

echo Step 5: Rebuilding Android app
cd android
call gradlew.bat assembleDebug --info
cd ..
echo.

echo ===== Fix process completed =====
echo.
