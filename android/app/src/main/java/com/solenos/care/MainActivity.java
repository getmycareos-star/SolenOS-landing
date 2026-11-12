package com.solenos.care;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.os.Build;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String CARE_UPDATES_CHANNEL = "care-updates";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        createCareUpdatesChannel();
    }

    private void createCareUpdatesChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }

        NotificationChannel channel = new NotificationChannel(
            CARE_UPDATES_CHANNEL,
            "Care updates",
            NotificationManager.IMPORTANCE_DEFAULT
        );
        channel.setDescription("Reminders and care updates from SolenOS.");
        channel.enableVibration(true);
        channel.setVibrationPattern(new long[] {0, 180, 90, 180});
        channel.setSound(
            RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),
            new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()
        );

        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.createNotificationChannel(channel);
        }
    }
}
