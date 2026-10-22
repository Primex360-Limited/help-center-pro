# Email Sync Setup Guide

This guide explains how to configure and use the professional bidirectional email synchronization feature in Help Centre Pro.

## Overview

The email sync feature allows agents to:
- Connect their Gmail or Outlook accounts via OAuth2
- Automatically sync incoming customer emails to Help Centre Pro tickets
- Send replies from Help Centre Pro that appear in their email provider's Sent folder
- Maintain a complete email history in both systems

## Prerequisites

### Gmail OAuth2 Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Gmail API:
   - Navigate to APIs & Services > Library
   - Search for "Gmail API" and enable it
4. Create OAuth 2.0 credentials:
   - Go to APIs & Services > Credentials
   - Click "Create Credentials" > "OAuth client ID"
   - Application type: Web application
   - Authorized redirect URIs: Add your frontend URL with the callback path
     - Example: `https://your-frontend.com/settings/email/callback/gmail`
5. Copy the Client ID and Client Secret

### Outlook/Microsoft Graph OAuth2 Setup

1. Go to [Azure Portal](https://portal.azure.com/)
2. Register a new application:
   - Navigate to Azure Active Directory > App registrations
   - Click "New registration"
   - Set redirect URI: `https://your-frontend.com/settings/email/callback/outlook`
3. Configure API permissions:
   - Go to API permissions > Add a permission
   - Select Microsoft Graph > Delegated permissions
   - Add these permissions:
     - `Mail.Read`
     - `Mail.Send`
     - `Mail.ReadWrite`
4. Generate client secret:
   - Go to Certificates & secrets > New client secret
   - Copy the secret value (you won't see it again)
5. Copy the Application (client) ID and Directory (tenant) ID

## Environment Variables

Add the following environment variables to your `.env` file:

```bash
# Email Encryption (Required)
EMAIL_ENCRYPTION_KEY=your-secure-encryption-key-min-32-chars

# Gmail OAuth2 (Required for Gmail integration)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=https://your-frontend.com/settings/email/callback/gmail

# Microsoft/Outlook OAuth2 (Required for Outlook integration)
MICROSOFT_CLIENT_ID=your-microsoft-client-id
MICROSOFT_CLIENT_SECRET=your-microsoft-client-secret
MICROSOFTFT_REDIRECT_URI=https://your-frontend.com/settings/email/callback/outlook

# Email Sync Worker Configuration
EMAIL_SYNC_INTERVAL=300000  # Sync interval in milliseconds (default: 5 minutes)
EMAIL_SYNC_BATCH_SIZE=50   # Number of emails to sync per cycle (default: 50)

# Frontend URL (for OAuth callbacks)
FRONTEND_URL=https://your-frontend.com
```

## Database Migration

After updating the Prisma schema, run the migration:

```bash
cd FUMS-HELP-CENTER-PRO-main/FUMS-HELP-CENTER-PRO-main
npx prisma migrate dev --name add_email_accounts
npx prisma generate
```

## Install Dependencies

Install the new npm packages:

```bash
cd FUMS-HELP-CENTER-PRO-main/FUMS-HELP-CENTER-PRO-main
npm install
```

## Server Configuration

The email sync worker is automatically initialized when the server starts. To configure it:

1. Open `server.js`
2. The worker starts automatically with the configured interval
3. You can adjust the interval via the `EMAIL_SYNC_INTERVAL` environment variable

## Frontend Configuration

The email settings page is available at:
- Route: `/workspace/email-settings`
- Permission: `settings:read`

### Adding the Navigation Link

Add the email settings link to your navigation menu in `AppShell.jsx`:

```jsx
<Link to="/workspace/email-settings">Email Settings</Link>
```

## Usage

### For Agents

1. Navigate to Workspace > Email Settings
2. Click "Add Account"
3. Choose your email provider (Gmail or Outlook)
4. Complete the OAuth authorization flow
5. The account will be automatically configured with default IMAP/SMTP settings
6. Test the connection using the "Test IMAP" and "Test SMTP" buttons
7. Enable sync to start automatic email synchronization

### For Administrators

Monitor the email sync worker:
- View worker statistics in the Email Settings page
- Check sync status for each account
- Trigger manual syncs if needed
- View error logs for troubleshooting

## Security Notes

- All OAuth tokens are encrypted using AES-256 encryption
- The encryption key is stored in the `EMAIL_ENCRYPTION_KEY` environment variable
- Never commit the encryption key or OAuth secrets to version control
- Use strong, unique encryption keys (minimum 32 characters)
- Rotate OAuth secrets periodically as recommended by Google and Microsoft

## Troubleshooting

### Gmail OAuth Fails

- Ensure the redirect URI matches exactly in Google Cloud Console
- Verify the Gmail API is enabled
- Check that the OAuth consent screen is configured
- Ensure the user has granted the required permissions

### Outlook OAuth Fails

- Verify the redirect URI matches in Azure Portal
- Check that API permissions are granted and admin consent is obtained
- Ensure the application is not in a disabled state
- Verify the tenant ID is correct for multi-tenant apps

### IMAP Connection Fails

- Check that the email account has IMAP enabled
- Verify the OAuth token is valid and not expired
- Ensure the IMAP host and port are correct
- Check firewall settings allow IMAP connections

### SMTP Connection Fails

- Verify the OAuth token has send permissions
- Check SMTP host and port settings
- Ensure the email provider allows SMTP access
- Verify the from email is verified (for some providers)

### Emails Not Syncing

- Check that the email account has `syncEnabled: true`
- Verify the worker is running (check stats in Email Settings)
- Check the last sync status and error messages
- Ensure the email account is active
- Try triggering a manual sync

### Emails Not Appearing in Sent Folder

- Verify SMTP connection is working
- Check that the email account is set as default
- Ensure the email was sent via SMTP (check `usedSmtp` flag in response)
- Some providers may have delays in updating the Sent folder

## API Endpoints

### Email Account Management

- `GET /api/v1/email-accounts` - List user's email accounts
- `GET /api/v1/email-accounts/default` - Get default email account
- `POST /api/v1/email-accounts` - Create email account
- `GET /api/v1/email-accounts/:id` - Get specific email account
- `PUT /api/v1/email-accounts/:id` - Update email account
- `DELETE /api/v1/email-accounts/:id` - Delete email account

### OAuth

- `GET /api/v1/email-accounts/oauth/:provider/auth-url` - Get OAuth URL
- `POST /api/v1/email-accounts/oauth/:provider/callback` - Handle OAuth callback

### Connection Testing

- `POST /api/v1/email-accounts/:id/test-imap` - Test IMAP connection
- `POST /api/v1/email-accounts/:id/test-smtp` - Test SMTP connection
- `GET /api/v1/email-accounts/:id/folders` - Get IMAP folders

### Sync Management

- `POST /api/v1/email-accounts/:id/sync` - Trigger sync for specific account
- `POST /api/v1/email-accounts/sync-all` - Trigger sync for all accounts
- `GET /api/v1/email-accounts/worker/stats` - Get worker statistics

## Support

For issues or questions:
- Check the application logs for detailed error messages
- Review the worker statistics in the Email Settings page
- Ensure all environment variables are correctly configured
- Verify OAuth credentials are valid and not expired
