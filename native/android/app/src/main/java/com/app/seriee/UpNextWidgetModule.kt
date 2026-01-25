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
    fun updateWidgetData(data: ReadableArray) {
        val sharedPref = context.getSharedPreferences("DATA", Context.MODE_PRIVATE)
        val editor = sharedPref.edit()

        // Store as raw JSON string for the provider to parse
        // We can't easily serialize ReadableArray directly to JSON string without a helper, 
        // but for simplicity we will iterate and build a manual JSON string or use a library if available.
        // Since we want to be zero-dependency if possible, let's assuming we pass a STRINGified JSON from JS.
        // WAIT: The plan said "Pass the entire list... to the native module". 
        // Best practice: JS sends a JSON string using JSON.stringify().
        
        // Let's change the signature to accept a String to be safe and easy.
    }

    @ReactMethod
    fun updateWidgetDataJson(jsonString: String) {
        val sharedPref = context.getSharedPreferences("DATA", Context.MODE_PRIVATE)
        val editor = sharedPref.edit()
        editor.putString("widgetData", jsonString)
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
