# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# WebRTC and WebView related rules for video calling
-keep class org.webrtc.** { *; }
-keep class android.webkit.** { *; }
-keep class com.facebook.react.views.webview.** { *; }
-keep class com.reactnativecommunity.webview.** { *; }

# Keep JavaScript interface methods for WebView
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep WebRTC native methods
-keepclassmembers class ** {
    native <methods>;
}

# Socket.io client
-keep class io.socket.** { *; }
-keep class com.github.nkzawa.** { *; }

# Audio recording related
-keep class com.rnim.rn.audio.** { *; }

# Add any project specific keep options here:
