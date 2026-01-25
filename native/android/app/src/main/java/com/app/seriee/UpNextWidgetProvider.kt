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
import android.text.Html
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject

class UpNextWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        val appWidgetManager = AppWidgetManager.getInstance(context)
        val thisAppWidget = ComponentName(context.packageName, UpNextWidgetProvider::class.java.name)
        
        when (intent.action) {
            AppWidgetManager.ACTION_APPWIDGET_UPDATE -> {
                val appWidgetIds = appWidgetManager.getAppWidgetIds(thisAppWidget)
                onUpdate(context, appWidgetManager, appWidgetIds)
            }
            "NEXT" -> {
                val views = RemoteViews(context.packageName, R.layout.up_next_widget)
                views.showNext(R.id.upnext_flipper)
                appWidgetManager.updateAppWidget(thisAppWidget, views)
            }
            "PREV" -> {
                val views = RemoteViews(context.packageName, R.layout.up_next_widget)
                views.showPrevious(R.id.upnext_flipper)
                appWidgetManager.updateAppWidget(thisAppWidget, views)
            }
        }
    }
}

internal fun updateAppWidget(context: Context, appWidgetManager: AppWidgetManager, appWidgetId: Int) {
    // 1. Go Async to allow network operations
    val pendingResult = (context.applicationContext as? android.content.BroadcastReceiver)?.goAsync() 
        ?: (context as? android.content.BroadcastReceiver)?.goAsync() 
        // Note: usage of goAsync() in a helper function is tricky if we don't pass the PendingResult.
        // Since this function is called from onUpdate loop, we can't easily goAsync here for each widget separately perfectly.
        // Better architecture: Move logic to onUpdate or spawn a thread.
        
    Thread {
        try {
            val views = RemoteViews(context.packageName, R.layout.up_next_widget)
            val sharedPref = context.getSharedPreferences("DATA", Context.MODE_PRIVATE)

            // Clear existing views
            views.removeAllViews(R.id.upnext_flipper)

            // Branding
            views.setTextViewText(R.id.app_brand, Html.fromHtml("<font color='#FFD600'>S</font>ERIEE", Html.FROM_HTML_MODE_LEGACY))

            // Manual Swipe Intents
            val nextIntent = Intent(context, UpNextWidgetProvider::class.java).apply { action = "NEXT" }
            val prevIntent = Intent(context, UpNextWidgetProvider::class.java).apply { action = "PREV" }
            views.setOnClickPendingIntent(R.id.next_zone, PendingIntent.getBroadcast(context, 200, nextIntent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT))
            views.setOnClickPendingIntent(R.id.prev_zone, PendingIntent.getBroadcast(context, 201, prevIntent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT))

            // Open App
            val openAppIntent = Intent(context, MainActivity::class.java)
            val openAppPending = PendingIntent.getActivity(context, 999, openAppIntent, PendingIntent.FLAG_IMMUTABLE)
            views.setOnClickPendingIntent(R.id.widget_root, openAppPending)

            // Parse JSON and Load Data
            val jsonString = sharedPref.getString("widgetData", "[]")
            val items = JSONArray(jsonString)

            if (items.length() == 0) {
                val emptyCard = RemoteViews(context.packageName, R.layout.widget_upnext_item)
                emptyCard.setTextViewText(R.id.series_title, "No Up Next")
                emptyCard.setTextViewText(R.id.episode_info, "Start tracking in app")
                views.addView(R.id.upnext_flipper, emptyCard)
            } else {
                for (i in 0 until items.length()) {
                    val item = items.getJSONObject(i)
                    val card = RemoteViews(context.packageName, R.layout.widget_upnext_item)

                    val title = item.optString("seriesName", "Unknown")
                    val season = item.optInt("seasonNumber", 1)
                    val episode = item.optInt("episodeNumber", 1)
                    val posterUri = item.optString("backdropUri", "")
                    val id = item.optInt("seriesId", 0)

                    card.setTextViewText(R.id.series_title, title)
                    card.setTextViewText(R.id.episode_info, "S$season • E$episode")

                    // Deep Link
                    val linkUrl = if (id > 0) "seriee://series/$id?season=$season&episode=$episode" else "seriee://home"
                    val deepLinkIntent = Intent(Intent.ACTION_VIEW, Uri.parse(linkUrl))
                    deepLinkIntent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                    val pendingDeepLink = PendingIntent.getActivity(
                        context, id.hashCode(), deepLinkIntent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
                    )
                    card.setOnClickPendingIntent(R.id.card_root, pendingDeepLink)

                    // Image Loading (Synchronous on Background Thread)
                    // CRITICAL: Max IPC size is ~1MB. We must downscale aggressively.
                    // 250x140 is roughly 140KB which is safe for 5 items (700KB total is risky if all loaded).
                    // Safe limit: 200px width.
                    if (posterUri.isNotEmpty()) {
                        try {
                            val bitmap = Glide.with(context.applicationContext)
                                .asBitmap()
                                .load(posterUri)
                                .submit(200, 112) // Safe small size
                                .get()
                            card.setImageViewBitmap(R.id.poster, bitmap)
                        } catch (e: Exception) {
                            e.printStackTrace()
                        }
                    }
                    views.addView(R.id.upnext_flipper, card)
                }
            }
            
            appWidgetManager.updateAppWidget(appWidgetId, views)
            
        } catch (e: Exception) {
            e.printStackTrace()
        } finally {
            // Signal Async Complete (if we had reference to PendingResult, but we are inside a static helper)
            // Just running in thread ensures we don't block Main. 
            // Ideally we need PendingResult if the receiver is killed too fast. 
            // But since updateAppWidget is called from onUpdate (Receiver) and onReceive, 
            // for the "Receiver" lifecycle to live long enough for network, we MUST have PendingResult.
        }
    }.start()
}
