package com.app.seriee

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.SharedPreferences
import android.widget.RemoteViews
import com.bumptech.glide.Glide
import com.bumptech.glide.request.target.AppWidgetTarget
import android.app.PendingIntent
import android.content.Intent
import android.content.ComponentName
import android.net.Uri

class UpNextWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == AppWidgetManager.ACTION_APPWIDGET_UPDATE) {
            val appWidgetManager = AppWidgetManager.getInstance(context)
            val thisAppWidget = ComponentName(context.packageName, UpNextWidgetProvider::class.java.name)
            val appWidgetIds = appWidgetManager.getAppWidgetIds(thisAppWidget)
            onUpdate(context, appWidgetManager, appWidgetIds)
        }
    }
}

internal fun updateAppWidget(context: Context, appWidgetManager: AppWidgetManager, appWidgetId: Int) {
    val views = RemoteViews(context.packageName, R.layout.up_next_widget)
    val sharedPref = context.getSharedPreferences("DATA", Context.MODE_PRIVATE)

    val seriesName = sharedPref.getString("seriesName", "No Series Tracking")
    val episodeInfo = sharedPref.getString("episodeInfo", "Track now")
    val backdropUri = sharedPref.getString("backdropUri", "")
    val seriesId = sharedPref.getInt("seriesId", 0)
    val seasonNumber = sharedPref.getInt("seasonNumber", 1)
    val episodeNumber = sharedPref.getInt("episodeNumber", 1)

    views.setTextViewText(R.id.widget_series_name, seriesName)
    views.setTextViewText(R.id.widget_episode_info, episodeInfo)

    // Deep Link
    // seriee://series/{id}?season={n}&episode={n}
    // We navigate to simple series page if 0
    val linkUrl = if (seriesId > 0) {
        "seriee://series/$seriesId?season=$seasonNumber&episode=$episodeNumber"
    } else {
        "seriee://home"
    }
    
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(linkUrl))
    intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
    val pendingIntent = PendingIntent.getActivity(
        context, 
        0, 
        intent, 
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    views.setOnClickPendingIntent(R.id.widget_container, pendingIntent) // Ensure root layout has id widget_container

    // Image Loading with Glide
     if (!backdropUri.isNullOrEmpty()) {
         try {
             val awt = AppWidgetTarget(context.applicationContext, R.id.widget_backdrop, views, appWidgetId)
             Glide.with(context.applicationContext)
                  .asBitmap()
                  .load(backdropUri)
                  .into(awt)
         } catch (e: Exception) {
             e.printStackTrace()
         }
     }

    appWidgetManager.updateAppWidget(appWidgetId, views)
}
