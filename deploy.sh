#!/bin/bash
set -euo pipefail

# Load nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

APP_DIR="/home/admin/SafeEasyFrontEnd"
LOG_FILE="/home/admin/deploy.log"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME=".next.backup.$TIMESTAMP"

# Logging function
log() {
    echo "[$(date '+%H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

error_exit() {
    log "ERROR: $1"
    log "Deploy failed. Check logs: $LOG_FILE"
    exit 1
}

# Start logging
echo "=========================================" > "$LOG_FILE"
log "Starting deploy - $TIMESTAMP"
log "========================================="

cd "$APP_DIR" || error_exit "Cannot change to $APP_DIR"

# Check disk space
DISK_AVAILABLE=$(df -P / | awk 'NR==2 {print $4}')
if [ "$DISK_AVAILABLE" -lt 2097152 ]; then
    error_exit "Insufficient disk space: ${DISK_AVAILABLE}KB available (need ~2GB)"
fi
log "Disk space OK: ${DISK_AVAILABLE}KB available"

# 1. Pull latest code
log "[1/10] Pulling latest code..."
if git pull --rebase; then
    log "   Code updated successfully"
else
    # Check if already up to date
    if git status | grep -q "Your branch is up to date"; then
        log "   Already up to date"
    else
        error_exit "Git pull failed"
    fi
fi

# 2. Stop Next.js server
log "[2/10] Stopping Next.js server..."
PIDS=$(pgrep -f "next start" || true)
if [ -n "$PIDS" ]; then
    echo "$PIDS" | xargs kill -TERM 2>/dev/null || true
    sleep 5
    
    # Force kill if still running
    if pgrep -f "next start" > /dev/null; then
        log "   Force killing..."
        echo "$PIDS" | xargs kill -9 2>/dev/null || true
        sleep 2
    fi
    log "   Server stopped"
else
    log "   Server not running"
fi

# 3. Backup current build
log "[3/10] Backing up current build..."
if [ -d ".next" ]; then
    mv .next "$BACKUP_NAME"
    log "   Backup created: $BACKUP_NAME"
else
    log "   No existing build to backup"
fi

# 4. Clean old backups (keep last 3)
log "[4/10] Cleaning old backups..."
BACKUPS=$(ls -td .next.backup.* 2>/dev/null | tail -n +4 || true)
if [ -n "$BACKUPS" ]; then
    echo "$BACKUPS" | xargs rm -rf
    log "   Removed old backups"
else
    log "   No old backups to clean"
fi

# 5. Setup swap if needed
log "[5/10] Checking memory..."
FREE_MEM=$(free -m | awk '/^Mem:/ {print $7}')
TOTAL_SWAP=$(free -m | awk '/^Swap:/ {print $2}')

if [ "$FREE_MEM" -lt 512 ] && [ ! -f /swapfile2 ]; then
    log "   Low memory ($FREE_MEM MB). Creating 2GB swap..."
    
    # Try fallocate first, fallback to dd
    if sudo fallocate -l 2G /swapfile2 2>/dev/null; then
        log "   Created with fallocate"
    else
        sudo dd if=/dev/zero of=/swapfile2 bs=1M count=2048 status=none
        log "   Created with dd"
    fi
    
    sudo chmod 600 /swapfile2
    sudo mkswap /swapfile2 2>&1 | tail -1
    sudo swapon /swapfile2
    log "   Swap activated"
    
    # Schedule cleanup
    (sleep 7200 && sudo swapoff /swapfile2 && sudo rm -f /swapfile2) &
    log "   Swap will auto-remove in 2 hours"
elif [ "$FREE_MEM" -lt 512 ] && [ -f /swapfile2 ]; then
    log "   Using existing swap ($TOTAL_SWAP MB available)"
else
    log "   Memory OK: $FREE_MEM MB free"
fi

# 6. Clear build cache
log "[6/10] Clearing build cache..."
rm -rf .next/cache 2>/dev/null || true
log "   Cache cleared"

# 7. Install dependencies
log "[7/10] Installing dependencies..."
if npm ci --legacy-peer-deps --no-audit --no-fund; then
    log "   Dependencies installed"
else
    error_exit "npm ci failed. Check logs."
fi

# 8. Build with memory optimization
log "[8/10] Building application..."
log "   This may take 3-5 minutes..."

export NODE_OPTIONS="--max-old-space-size=512"
if npm run build >> "$LOG_FILE" 2>&1; then
    log "   Build successful"
else
    log "   Build failed!"
    log "   Attempting rollback..."
    
    # Rollback
    if [ -d "$BACKUP_NAME" ]; then
        mv "$BACKUP_NAME" .next
        log "   Rollback complete - restored previous build"
    fi
    
    error_exit "Build failed. Rolled back to previous version."
fi

# 9. Start server
log "[9/10] Starting Next.js server..."
nohup npm start >> /home/admin/nextjs.log 2>&1 &
SERVER_PID=$!
disown $SERVER_PID

# Wait and verify
sleep 8
if pgrep -f "next start" > /dev/null; then
    ACTUAL_PID=$(pgrep -f "next start" | head -1)
    log "   Server started (PID: $ACTUAL_PID)"
else
    log "   WARNING: Server may not have started properly"
    log "   Check: tail -f /home/admin/nextjs.log"
fi

# 10. Verify deployment
log "[10/10] Verifying deployment..."
sleep 5

if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -q "200"; then
    log "   Health check passed (HTTP 200)"
else
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 || echo "failed")
    log "   WARNING: Health check returned HTTP $HTTP_CODE"
    log "   Server may still be starting up"
fi

# Summary
log ""
log "========================================="
log " Deploy Summary"
log "========================================="
log "Timestamp: $TIMESTAMP"
log "Backup: $BACKUP_NAME"
log "Server PID: $(pgrep -f 'next start' | head -1 || echo 'N/A')"
log "Logs: tail -f /home/admin/nextjs.log"
log "Deploy log: $LOG_FILE"
log ""

# Show current memory
log "Current memory status:"
free -h | tee -a "$LOG_FILE"
log ""

if [ -d ".next" ] && pgrep -f "next start" > /dev/null; then
    log " Deploy completed successfully!"
    log " Changes are now live."
else
    log " Deploy finished with warnings."
    log " Check logs for details."
fi

log "========================================="

# Exit with success
exit 0
