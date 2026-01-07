#!/bin/bash

APP_NAME="Dev Control Panel"
APP_DIR="$PWD/$APP_NAME.app"
MACOS_DIR="$APP_DIR/Contents/MacOS"
RESOURCES_DIR="$APP_DIR/Contents/Resources"
CURRENT_DIR="$PWD"

echo "Building $APP_NAME.app in $CURRENT_DIR..."

# Create Release Directories
rm -rf "$APP_DIR" # Clean previous build
mkdir -p "$MACOS_DIR"
mkdir -p "$RESOURCES_DIR"

# 1. Create Info.plist
cat > "$APP_DIR/Contents/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>launcher</string>
    <key>CFBundleIdentifier</key>
    <string>com.cscodex.devpanel</string>
    <key>CFBundleName</key>
    <string>$APP_NAME</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>CFBundleVersion</key>
    <string>1</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.10</string>
    <key>NSHighResolutionCapable</key>
    <true/>
</dict>
</plist>
EOF

# 2. Create the Launcher Script
# We hardcode the project directory so the App can be moved to /Applications
cat > "$MACOS_DIR/launcher" <<EOF
#!/bin/bash

# Hardcoded Project Path
PROJECT_DIR="$CURRENT_DIR"
NODE_PATH="/opt/homebrew/bin/node"
PORT=3333
URL="http://localhost:\$PORT"
LOG_FILE="\$PROJECT_DIR/app-launch.log"

# Function to log messages
log() {
    echo "\$(date): \$1" >> "\$LOG_FILE"
}

# Ensure we are in the project directory
cd "\$PROJECT_DIR"

log "Starting Dev Control Panel App..."

# Check if port is in use and kill it
if lsof -ti:\$PORT > /dev/null; then
    log "Port \$PORT in use. Killing existing process..."
    lsof -ti:\$PORT | xargs kill -9 2>/dev/null
fi

# Cleanup function to kill the node server when the App terminates
cleanup() {
    log "App terminating. Killing server PID \$PID..."
    if [ -n "\$PID" ]; then
        kill \$PID
    fi
    exit
}

# Trap signals (Quit from Dock, CMD+Q, etc.)
trap cleanup SIGINT SIGTERM EXIT

# Start the Node Server
log "Launching node server..."
"\$NODE_PATH" server.js >> "\$LOG_FILE" 2>&1 &
PID=\$!

# Wait a moment for server to initialize
sleep 2

# Open the Browser
log "Opening browser at \$URL"
open "\$URL"

# Wait for the server process. This keeps the App "Running" in the Dock.
wait \$PID
EOF

# 3. Make launcher executable
chmod +x "$MACOS_DIR/launcher"

echo "✅ App created successfully at: $APP_DIR"
echo ""
echo "Instructions:"
echo "1. You can move '$APP_NAME' to your /Applications folder."
echo "2. To Autostart: Open 'System Settings' -> 'General' -> 'Login Items', click (+), and add '$APP_NAME'."
