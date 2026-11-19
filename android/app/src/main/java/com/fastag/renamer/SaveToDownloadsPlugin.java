package com.fastag.renamer;

import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;

@CapacitorPlugin(name = "SaveToDownloads")
public class SaveToDownloadsPlugin extends Plugin {
    private static final String TAG = "SaveToDownloads";
    private static final String DOWNLOADS_FOLDER = "FASTag PDF Renamer";

    @PluginMethod
    public void save(PluginCall call) {
        String fileName = call.getString("fileName");
        String mimeType = call.getString("mimeType");
        String encodedData = call.getString("data");
        if (fileName == null || fileName.trim().isEmpty()
                || fileName.contains("/") || fileName.contains("\\")
                || mimeType == null || mimeType.trim().isEmpty()
                || encodedData == null || encodedData.isEmpty()) {
            call.reject("A file name, MIME type, and file data are required.");
            return;
        }

        Uri insertedUri = null;
        try {
            byte[] data = Base64.decode(encodedData, Base64.DEFAULT);
            String location;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues values = new ContentValues();
                values.put(MediaStore.MediaColumns.DISPLAY_NAME, fileName);
                values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
                values.put(MediaStore.MediaColumns.RELATIVE_PATH,
                        Environment.DIRECTORY_DOWNLOADS + "/" + DOWNLOADS_FOLDER);
                values.put(MediaStore.MediaColumns.IS_PENDING, 1);

                insertedUri = getContext().getContentResolver().insert(
                        MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (insertedUri == null) {
                    throw new IOException("Android could not create the download file.");
                }

                try (OutputStream output = getContext().getContentResolver().openOutputStream(insertedUri)) {
                    if (output == null) {
                        throw new IOException("Android could not open the download file.");
                    }
                    output.write(data);
                }

                ContentValues published = new ContentValues();
                published.put(MediaStore.MediaColumns.IS_PENDING, 0);
                int updated = getContext().getContentResolver().update(insertedUri, published, null, null);
                if (updated != 1) {
                    throw new IOException("Android could not publish the completed download.");
                }
                location = "Downloads/" + DOWNLOADS_FOLDER;
            } else {
                File downloads = getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                if (downloads == null) {
                    throw new IOException("App storage is not available.");
                }
                File folder = new File(downloads, DOWNLOADS_FOLDER);
                if (!folder.exists() && !folder.mkdirs()) {
                    throw new IOException("Could not create the app downloads folder.");
                }
                File outputFile = new File(folder, fileName);
                try (FileOutputStream output = new FileOutputStream(outputFile)) {
                    output.write(data);
                }
                location = "App files/Downloads/" + DOWNLOADS_FOLDER;
            }

            JSObject result = new JSObject();
            result.put("location", location);
            call.resolve(result);
        } catch (Exception error) {
            if (insertedUri != null) {
                try {
                    getContext().getContentResolver().delete(insertedUri, null, null);
                } catch (Exception cleanupError) {
                    Log.w(TAG, "Could not remove incomplete download.", cleanupError);
                }
            }
            call.reject("Could not save the file to device storage.", error);
        }
    }
}
