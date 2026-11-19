# FASTag PDF Renamer

A mobile-friendly installable web app for renaming multiple FASTag PDF reports. PDF files are read and renamed in the browser; they are never uploaded.

The Android app is packaged with Capacitor. Each push to `main` builds a debug-signed APK and publishes it as a GitHub Release. On Android, download `fastag-pdf-renamer.apk` from the repository's Releases page and install it. Android may ask you to allow your browser to install apps. This APK is not Play Store-signed; uninstall the previous debug build before installing a newer one if Android rejects the update.

The current upload queue is replaced whenever a new PDF selection is added. Downloaded reports are recorded in vehicle history saved in that browser on that device. Use **Export Excel** to download the complete history (`.xlsx`), including the vehicle number, prefix, date, and renamed filename. Browser history is not synced between devices; keep the Excel file as a backup.

## Run locally

```sh
npm install
npm run dev
```

Open the local address printed by Vite. To create a production build, run `npm run build`; the deployable app is written to `dist`.

## Use on a phone

Deploy the contents of `dist` to any static web host that serves HTTPS, then open its address on the phone. A Render static-site definition is included in `render.yaml`; create a Render Static Site from the GitHub repository and select **Apply** for the Blueprint, or use `npm ci` as the build command and `dist` as the publish directory. On Android Chrome, use **Install app** when offered, or choose **Add to Home screen** from the browser menu. On iPhone, use **Share → Add to Home Screen** in Safari. The app can then be opened from the home screen and works offline after its first successful load.

To build the Android app locally, install Android Studio and its Android SDK, then run `npm run android:apk`. The debug APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`.

## Rename format

The app creates names in this format:

```text
Magma_VEHICLENUMBER_FASTag_Report_18th Nov26.pdf
```

It keeps the first vehicle number found in the original filename. If there is none, it searches the PDF's selectable text. If a number cannot be found, enter it in that file's vehicle-number field. The name and date can be changed before downloading. All renamed PDFs are delivered together in one ZIP file.
