# Testing OTP Email Service

## Setup Complete ✅

The email service has been successfully integrated! Here's what was implemented:

### Features:
1. **Nodemailer Integration** - Free, open-source email library
2. **Development Mode** - OTP included in API response (only in development!)
3. **Production Ready** - Beautiful HTML email templates for OTP delivery
4. **Graceful Fallback** - Works without SMTP credentials (logs to console)

## How to Test

### Option 1: Development Mode (Current Setup)

The OTP will be included directly in the API response when registering or resending:

```bash
# Register a new user
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "owner2@example.com",
    "password": "TestPass123",
    "name": "Test User"
  }'

# Response will include:
{
  "success": true,
  "data": {
    "user": {
      "id": "...",
      "email": "owner2@example.com",
      "name": "Test User"
    },
    "otp": "123456",  // <-- OTP visible in development mode!
    "message": "Registration successful. Please verify your email with the OTP sent."
  }
}
```

### Option 2: With Email (Production)

Configure SMTP credentials in `.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-16-char-app-password  # From Google App Passwords
SMTP_FROM_EMAIL=your-email@gmail.com
SMTP_FROM_NAME=Esnaad Dashboard
```

Then register - you'll receive a beautiful HTML email with the OTP!

### Option 3: View in Database

```bash
# Open Prisma Studio
npm run prisma:studio

# Navigate to: otps table
# You'll see the hashed OTP stored securely
```

## Email Template Preview

When SMTP is configured, users receive:

```
┌─────────────────────────────────────┐
│    🔐 Email Verification            │
├─────────────────────────────────────┤
│                                      │
│  Hello [Name],                       │
│                                      │
│  Your verification code is:          │
│                                      │
│  ┌──────────────────────┐           │
│  │    1 2 3 4 5 6        │           │
│  └──────────────────────┘           │
│                                      │
│  ⚠️ Expires in 10 minutes            │
│                                      │
│  Best regards,                       │
│  Esnaad Dashboard Team               │
└─────────────────────────────────────┘
```

## Testing Steps

1. **Start the server**: `npm run dev`
2. **Register a new user** with one of the pre-seeded emails:
   - `owner2@example.com` (if not already registered)
3. **Check the API response** - OTP will be in the response (development mode only)
4. **Verify the OTP**:
   ```bash
   curl -X POST http://localhost:8080/api/auth/verify-otp \
     -H "Content-Type: application/json" \
     -d '{
       "email": "owner2@example.com",
       "otp": "123456"
     }'
   ```

## Security Notes

- ✅ OTP in response is **ONLY in development mode** (`NODE_ENV=development`)
- ✅ In production, OTP is **ONLY sent via email** (never in response)
- ✅ OTP is stored **hashed** in the database (SHA-256)
- ✅ OTP expires in **10 minutes**
- ✅ Maximum **5 attempts** before requiring new OTP
- ✅ Maximum **3 resends** per registration

## Free SMTP Options

- **Gmail**: 500 emails/day (requires App Password)
- **Outlook**: Free tier available
- **SendGrid**: 100 emails/day free
- **Mailgun**: 5,000 emails/month free
- **Brevo**: 300 emails/day free

---

**Status**: ✅ Fully implemented and ready to use!
