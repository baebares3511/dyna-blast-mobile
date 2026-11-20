// Run after `npx cap add android`: forces landscape, fullscreen (immersive)
// and keeps the screen on while playing.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = path.join(root, 'android', 'app', 'src', 'main');

function patch(file, fn) {
  const p = path.join(app, file);
  if (!fs.existsSync(p)) { console.warn('skip (missing):', p); return; }
  const before = fs.readFileSync(p, 'utf8');
  const after = fn(before);
  if (after !== before) { fs.writeFileSync(p, after); console.log('patched', file); }
}

patch('AndroidManifest.xml', (s) => {
  if (!s.includes('android:screenOrientation')) {
    s = s.replace(/<activity\b/, '<activity\n            android:screenOrientation="sensorLandscape"');
  }
  return s;
});

patch(path.join('res', 'values', 'styles.xml'), (s) => {
  if (s.includes('android:windowFullscreen')) return s;
  return s.replace(
    /(<style name="AppTheme\.NoActionBar"[^>]*>)/,
    '$1\n        <item name="android:windowFullscreen">true</item>\n        <item name="android:windowLayoutInDisplayCutoutMode">shortEdges</item>',
  );
});

// version from CI (APP_VERSION_CODE = build number), so every new APK
// installs as an update over the previous one
const versionCode = parseInt(process.env.APP_VERSION_CODE || '', 10);
if (versionCode > 0) {
  const gradle = path.join(root, 'android', 'app', 'build.gradle');
  if (fs.existsSync(gradle)) {
    let s = fs.readFileSync(gradle, 'utf8');
    s = s.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`)
      .replace(/versionName\s+"[^"]*"/, `versionName "1.${versionCode}"`);
    fs.writeFileSync(gradle, s);
    console.log('version', versionCode);
  }
}

// immersive sticky mode + keep screen on
const javaDir = path.join(app, 'java', 'com', 'dynablast', 'mobile');
const mainActivity = path.join(javaDir, 'MainActivity.java');
if (fs.existsSync(javaDir)) {
  fs.writeFileSync(mainActivity, `package com.dynablast.mobile;

import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        hideSystemUi();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemUi();
    }

    @SuppressWarnings("deprecation")
    private void hideSystemUi() {
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_FULLSCREEN);
    }
}
`);
  console.log('patched MainActivity.java');
}
