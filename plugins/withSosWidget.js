const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo Config Plugin that configures a native Android Home Screen SOS Widget.
 * The widget renders a prominent emergency button on the user's home screen.
 * Tapping the widget fires an intent with `womensafety://sos`, cold-booting
 * straight into the SOS countdown screen without opening the main app manually.
 */
function withSosWidget(config) {
  // 1. Update AndroidManifest.xml
  config = withAndroidManifest(config, (configProps) => {
    const mainApplication = configProps.modResults.manifest.application?.[0];
    if (!mainApplication) return configProps;

    if (!mainApplication.receiver) {
      mainApplication.receiver = [];
    }

    const existingReceiver = mainApplication.receiver.find(
      (r) => r.$?.['android:name'] === '.SosWidgetProvider'
    );

    if (!existingReceiver) {
      mainApplication.receiver.push({
        $: {
          'android:name': '.SosWidgetProvider',
          'android:exported': 'true',
          'android:label': 'SafeHer SOS',
        },
        'intent-filter': [
          {
            action: [
              {
                $: {
                  'android:name': 'android.appwidget.action.APPWIDGET_UPDATE',
                },
              },
            ],
          },
        ],
        'meta-data': [
          {
            $: {
              'android:name': 'android.appwidget.provider',
              'android:resource': '@xml/sos_widget_info',
            },
          },
        ],
      });
    }

    return configProps;
  });

  // 2. Add native resource files (Layout, Provider XML, and Java Class)
  config = withDangerousMod(config, [
    'android',
    async (configProps) => {
      const projectRoot = configProps.modRequest.projectRoot;
      const resDir = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res');
      const xmlDir = path.join(resDir, 'xml');
      const layoutDir = path.join(resDir, 'layout');
      const javaDir = path.join(
        projectRoot,
        'android',
        'app',
        'src',
        'main',
        'java',
        'com',
        'safeher',
        'app'
      );

      // Ensure directories exist
      [xmlDir, layoutDir, javaDir].forEach((dir) => {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      });

      // Write widget info XML
      const widgetInfoXml = `<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="100dp"
    android:minHeight="100dp"
    android:updatePeriodMillis="0"
    android:initialLayout="@layout/sos_widget"
    android:resizeMode="horizontal|vertical"
    android:widgetCategory="home_screen"
    android:description="@string/app_name" />
`;
      fs.writeFileSync(path.join(xmlDir, 'sos_widget_info.xml'), widgetInfoXml);

      // Write widget layout XML (High contrast red round emergency button)
      const widgetLayoutXml = `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/widget_root"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:gravity="center"
    android:orientation="vertical"
    android:background="#e91e8c"
    android:padding="12dp">

    <TextView
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="🆘"
        android:textSize="36sp" />

    <TextView
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="EMERGENCY SOS"
        android:textColor="#ffffff"
        android:textSize="12sp"
        android:textStyle="bold"
        android:gravity="center"
        android:layout_marginTop="4dp" />
</LinearLayout>
`;
      fs.writeFileSync(path.join(layoutDir, 'sos_widget.xml'), widgetLayoutXml);

      // Write SosWidgetProvider.java
      const javaContent = `package com.safeher.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;

public class SosWidgetProvider extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("womensafety://sos"));
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);

            PendingIntent pendingIntent = PendingIntent.getActivity(
                context,
                0,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.sos_widget);
            views.setOnClickPendingIntent(R.id.widget_root, pendingIntent);

            appWidgetManager.updateAppWidget(appWidgetId, views);
        }
    }
}
`;
      fs.writeFileSync(path.join(javaDir, 'SosWidgetProvider.java'), javaContent);

      return configProps;
    },
  ]);

  return config;
}

module.exports = withSosWidget;
