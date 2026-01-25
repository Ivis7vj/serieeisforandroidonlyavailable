package com.app.seriee

import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap

class UpNextWidgetModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    private val context: Context = reactContext

    override fun getName(): String {
        return "UpNextWidgetModule"
    }

    @ReactMethod
    fun updateWidgetData(data: ReadableMap) {
        val sharedPref = context.getSharedPreferences("DATA", Context.MODE_PRIVATE)
        val editor = sharedPref.edit()

        editor.putString("seriesName", data.getString("seriesName"))
        editor.putString("episodeInfo", data.getString("episodeInfo"))
        editor.putString("backdropUri", data.getString("backdropUri"))
        if (data.hasKey("seriesId")) editor.putInt("seriesId", data.getInt("seriesId"))
        if (data.hasKey("seasonNumber")) editor.putInt("seasonNumber", data.getInt("seasonNumber"))
        if (data.hasKey("episodeNumber")) editor.putInt("episodeNumber", data.getInt("episodeNumber"))
        editor.apply()

        // Trigger Widget Update
        val manualUpdateIntent = Intent(context, UpNextWidgetProvider::class.java)
        manualUpdateIntent.action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
        
        val appWidgetManager = AppWidgetManager.getInstance(context)
        val ids = appWidgetManager.getAppWidgetIds(ComponentName(context, UpNextWidgetProvider::class.java))
        manualUpdateIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
        
        context.sendBroadcast(manualUpdateIntent)
    }
}
