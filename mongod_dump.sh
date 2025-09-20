#!/bin/bash

export $(grep -v '^#' '/home/admin/typikon-web/.env.production' | xargs)

# Define variables
MONGODB_HOST="$MONGODB_URI_HOST"
MONGODB_PORT="$MONGODB_URI_PORT"
MONGODB_USER=""      # Leave empty if no auth is enabled
MONGODB_PASSWORD=""  # Leave empty if no auth is enabled
BACKUP_DIR="/home/admin/db-backup"
DATE=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_FILE="mongodb_backup_$DATE.archive"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Build the mongodump command
MONGODUMP_CMD="mongodump --host $MONGODB_HOST --port $MONGODB_PORT"

# Add authentication if enabled
if [ -n "$MONGODB_USER" ] && [ -n "$MONGODB_PASSWORD" ]; then
  MONGODUMP_CMD="$MONGODUMP_CMD --username $MONGODB_USER --password $MONGODB_PASSWORD --authenticationDatabase admin"
fi

# Add SSL/TLS options if needed
# MONGODUMP_CMD="$MONGODUMP_CMD --ssl --sslCAFile /path/to/your/ca.pem"

# Perform the backup
$MONGODUMP_CMD --archive="$BACKUP_DIR/$BACKUP_FILE" --gzip

# Check if the backup was successful
if [ $? -eq 0 ]; then
  echo "MongoDB backup created successfully: $BACKUP_DIR/$BACKUP_FILE"
else
  echo "MongoDB backup failed."
  exit 1
fi

find "$BACKUP_DIR" -type f -name "mongodb_backup_*.archive" -mtime +7 -delete

exit 0
