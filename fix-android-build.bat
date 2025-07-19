@echo off
echo ===== Android Build Fix Script =====
echo.

echo Step 1: Cleaning node_modules and cache
call npm cache clean --force
echo.

echo Step 2: Removing node_modules folder
rmdir /s /q node_modules
echo.

echo Step 3: Cleaning Android build files
cd android
call gradlew.bat clean
cd ..
echo.

echo Step 4: Reinstalling dependencies
call npm install
echo.

echo Step 5: Rebuilding Android app
cd android
call gradlew.bat assembleDebug --stacktrace
cd ..
echo.

echo ===== Build process completed =====
echo Check the output above for any errors
echo.
