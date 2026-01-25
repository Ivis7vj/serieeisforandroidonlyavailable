# Keep our Widget Provider and Module
-keep class com.app.seriee.UpNextWidgetProvider { *; }
-keep class com.app.seriee.UpNextWidgetModule { *; }
-keep class com.app.seriee.UpNextWidgetPackage { *; }

# Keep React Native Bridge (Just in case)
-keep class com.facebook.react.bridge.** { *; }

# Keep Glide (Standard rules, usually auto-included but good to be safe)
-keep public class * implements com.bumptech.glide.module.GlideModule
-keep public class * extends com.bumptech.glide.module.AppGlideModule
-keep public enum com.bumptech.glide.load.ImageHeaderParser$** {
  **[] $VALUES;
  public *;
}
