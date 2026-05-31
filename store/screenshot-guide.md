# Google Play Store — Screenshot Guide

## Required Screenshots
Google Play requires at least **2 phone screenshots** and recommends a **feature graphic**.

### Screenshot Dimensions
| Asset | Size | Format |
|-------|------|--------|
| Phone screenshots | 1080×1920 (min 320px, max 3840px) | PNG or JPEG |
| Feature graphic | 1024×500 | PNG or JPEG |
| Tablet screenshot (optional) | 2048×2732 | PNG or JPEG |

### Recommended Screenshots to Capture

1. **Home Screen** — Game mode selection screen showing "Play Together", "Play Offline", "Quick Match" buttons
2. **In-Game (Board)** — Active game board with both moves visible (shadow + solid), team indicator showing Crown vs Bot icons
3. **Post-Game** — Game over screen showing winner and stats (trophy + result)
4. **Move Replay** — Replay screen showing board + move stepper with dual-move display
5. **History** — Match history page showing game cards with stats
6. **Friends Panel** — Friends list with online status and chat

### How to Capture (Android Emulator)
```bash
# Take screenshot via adb
adb shell screencap -p /sdcard/screenshot.png
adb pull /sdcard/screenshot.png .

# Or use Android Studio's Device Explorer → right-click → Save Screenshot
```

### How to Capture (Web)
1. Open Chrome DevTools → Device Toolbar (Ctrl+Shift+M)
2. Set device to "Pixel 7" (412×915 viewport)
3. Navigate through app and use the "Capture screenshot" button

### Feature Graphic Design
The feature graphic appears at the top of the Play Store listing.
Design it as a 1024×500 promotional banner featuring:
- ChessDuo logo (gold crown/queen icon) on dark background
- Tagline: "Play Smart. Team Up. ChessDuo."
- Chess pieces with dual-move shadow effect
- Can be created in Figma, Canva, or Photoshop

### Upload Location
Google Play Console → Store presence → Main store listing → Graphics
