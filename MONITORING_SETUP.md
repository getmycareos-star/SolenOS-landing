# SolenOS Uptime Kuma Monitoring Setup

This document explains how to set up production-ready uptime monitoring for SolenOS using Uptime Kuma.

## Overview

Uptime Kuma is deployed to monitor the availability of SolenOS services:
- Frontend: https://solenosai.netlify.app
- Backend API: https://solenosbackend-production-8773.up.railway.app
- Backend Health Endpoint: https://solenosbackend-production-8773.up.railway.app/health
- PostgreSQL Database (internal monitoring recommended)

## Deployment

Uptime Kuma is deployed using Docker Compose:

```bash
# Start Uptime Kuma
docker-compose up -d

# Verify it's running
docker-compose ps

# Access the web interface at http://localhost:3001
```

The deployment uses:
- Image: `louislam/uptime-kuma:1.23.1` (specific stable version)
- Port: 3001 (host) -> 3001 (container)
- Persistent storage: ./uptime-kuma-data:/app/data
- Restart policy: unless-stopped

## Monitor Configuration

Once Uptime Kuma is running, access the web interface at http://localhost:3001 and create the following monitors:

### 1. SolenOS — Frontend
- **Type**: HTTP(s)
- **Name**: SolenOS — Frontend
- **URL**: https://solenosai.netlify.app
- **Interval**: 60 seconds
- **Retry**: 3
- **Timeout**: 10 seconds
- **Heartbeat**: ✓ Enable heartbeat monitoring
- **Keyword**: SolenOS (verify expected content is served)

### 2. SolenOS — Backend API
- **Type**: HTTP(s)
- **Name**: SolenOS — Backend API
- **URL**: https://solenosbackend-production-8773.up.railway.app/health
- **Interval**: 30 seconds
- **Retry**: 2
- **Timeout**: 5 seconds
- **HTTP Method**: GET
- **Accept Status Codes**: 200-299
- **Keyword**: healthy (verify health check response)

### 3. SolenOS — Database (PostgreSQL)
*Note: Since the database is internal-only, monitor through backend or deploy Uptime Kuma in same network*

Option A: Indirect monitoring via backend health check (recommended for internal DB)
- The backend health check should verify database connectivity

Option B: Direct TCP monitoring (if Uptime Kuma can access DB network)
- **Type**: TCP
- **Name**: SolenOS — Database
- **Hostname**: [database-host]
- **Port**: 5432
- **Interval**: 60 seconds

## Alert Configuration

Configure notifications in Uptime Kuma → Notification Settings:

### Recommended Channels:
1. **Email** (for critical alerts)
2. **Discord/Slack** (for team notifications)
3. **SMS** (via Twilio or similar for urgent alerts)

### Notification Settings:
- **When to notify**: On DOWN and UP
- **Retry notification**: Every 30 minutes until resolved
- **Include**: Monitor name, status, timestamp, response time

## Security Considerations

1. **Access Control**: 
   - Enable authentication in Uptime Kuma Settings → General → Enable authentication
   - Create strong password for admin account
   - Consider enabling 2FA if available

2. **Network Security**:
   - Uptime Kuma dashboard should not be exposed publicly without authentication
   - Consider reverse proxy with HTTPS for remote access
   - Keep Uptime Kuma updated regularly

3. **Data Protection**:
   - Monitoring data stored in ./uptime-kuma-data is encrypted at rest if Docker volume encryption is enabled
   - Regular backups of the data directory recommended

## Maintenance

### Backup and Restore
```bash
# Backup
tar -czf uptime-kuma-backup.tar.gz ./uptime-kuma-data

# Restore
tar -xzf uptime-kuma-backup.tar.gz
docker-compose down
# Replace data directory contents
docker-compose up -d
```

### Updating Uptime Kuma
```bash
docker-compose pull
docker-compose up -d
```

### Logs
```bash
docker-compose logs -f uptime-kuma
```

## Verification

After setup, verify:

1. All monitors show "UP" status
2. Test notifications by temporarily stopping a service
3. Verify monitor configuration persists after restart:
   ```bash
   docker-compose restart uptime-kuma
   ```
4. Check that historical data is retained

## Troubleshooting

### Common Issues:
1. **Monitor shows false DOWN**:
   - Check timeout settings (increase if backend is slow)
   - Verify keyword matches exactly
   - Check network connectivity from Uptime Kuma host

2. **Notifications not sending**:
   - Verify notification credentials are correct
   - Test notification channel in Uptime Kuma settings
   - Check spam/junk folders for email notifications

3. **Dashboard not accessible**:
   - Verify container is running: `docker-compose ps`
   - Check port mapping: `docker-compose port uptime-kuma 3001`
   - Review logs: `docker-compose logs uptime-kuma`

## Known Limitations

1. **Single Point of Failure**: If Uptime Kuma host goes down, monitoring is unavailable
   - Consider deploying Uptime Kuma on separate infrastructure from SolenOS
   - For critical deployments, consider external monitoring service

2. **Database Monitoring**: Direct database monitoring requires network access
   - Internal databases should be monitored through application health checks
   - Consider adding database connectivity checks to backend health endpoint

## Files Modified

1. `backend/app/main.py` - Added health check endpoint
2. `docker-compose.yml` - Added Uptime Kuma service definition
3. Created `./uptime-kuma-data/` directory for persistent storage

## Validation Steps Performed

1. ✓ Added health check endpoint to backend
2. ✓ Deployed Uptime Kuma using Docker Compose
3. ✓ Verified Uptime Kuma container is running and healthy
4. ✓ Confirmed web interface accessibility on port 3001
5. ✓ Documented monitor configuration for all SolenOS services
6. ✓ Documented alert setup and notification configuration
7. ✓ Documented backup, restore, and maintenance procedures
8. ✓ Identified security considerations and best practices

## Next Steps for Operator

1. Access Uptime Kuma at http://localhost:3001 (or your domain if reverse proxied)
2. Complete initial setup (create admin account)
3. Configure notification channels with your preferred providers
4. Add the three monitors as specified above
5. Test notifications by triggering a manual DOWN state
6. Set up regular backups of the uptime-kuma-data directory
7. Consider setting up HTTPS reverse proxy for production access