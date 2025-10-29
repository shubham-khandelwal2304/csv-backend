# Rate Limiting Configuration

This service uses `express-rate-limit` with per-endpoint rules. Defaults are safe for small deployments and can be tuned via environment variables:

- **Uploads** (`POST /api/jobs`): 10/hour per IP — `RL_UPLOAD_MAX`
- **Status** (`GET /api/jobs/:jobId/status`): 30/10s per IP — `RL_STATUS_MAX`
- **Downloads** (`GET /api/files/download/:fileId`): 60/min per IP — `RL_DOWNLOAD_MAX`
- **Files list** (`GET /api/files`): 120/min per IP — `RL_LIST_MAX`
- **Delete** (`DELETE /api/files/:fileId`): 20/hour per IP — `RL_DELETE_MAX`

Set `TRUST_PROXY=1` when deploying behind a reverse proxy (e.g., Render, Vercel, Nginx) so IPs are derived from `X-Forwarded-For`.

## Environment Variables

### Rate Limiting Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `RL_UPLOAD_MAX` | `10` | Max uploads per hour per IP |
| `RL_STATUS_MAX` | `30` | Max status checks per 10 seconds per IP |
| `RL_DOWNLOAD_MAX` | `60` | Max downloads per minute per IP |
| `RL_LIST_MAX` | `120` | Max list requests per minute per IP |
| `RL_DELETE_MAX` | `20` | Max delete requests per hour per IP |

### Proxy Configuration

| Variable | Values | Description |
|----------|--------|-------------|
| `TRUST_PROXY` | `1` or `true` | Enable trust proxy mode for correct IP detection |

## Example Configuration

```env
# Rate Limiting
RL_UPLOAD_MAX=10
RL_STATUS_MAX=30
RL_DOWNLOAD_MAX=60
RL_LIST_MAX=120
RL_DELETE_MAX=20

# Proxy Configuration (set when behind reverse proxy)
TRUST_PROXY=1
```

## Rate Limit Headers

Responses include standard rate limit headers:

- `RateLimit-Limit` - Maximum number of requests allowed
- `RateLimit-Remaining` - Number of requests remaining in current window
- `RateLimit-Reset` - Time when the rate limit resets (Unix timestamp)

## Error Responses

When a rate limit is exceeded, the API returns a `429 Too Many Requests` status:

```json
{
  "error": "Too many file uploads. Please try again later.",
  "code": "UPLOAD_RATE_LIMIT_EXCEEDED"
}
```

Error codes:
- `UPLOAD_RATE_LIMIT_EXCEEDED` - Upload limit exceeded
- `STATUS_RATE_LIMIT_EXCEEDED` - Status check limit exceeded
- `DOWNLOAD_RATE_LIMIT_EXCEEDED` - Download limit exceeded
- `LIST_RATE_LIMIT_EXCEEDED` - List limit exceeded
- `DELETE_RATE_LIMIT_EXCEEDED` - Delete limit exceeded

## Deployment Notes

### Behind Reverse Proxy

When deploying behind a reverse proxy (Render, Vercel, Nginx, etc.), set:

```env
TRUST_PROXY=1
```

This ensures that rate limiting uses the actual client IP from the `X-Forwarded-For` header instead of the proxy server's IP.

### Recommended Settings

**Production:**
- Keep default limits or adjust based on actual usage
- Always set `TRUST_PROXY=1` when behind a proxy

**Development:**
- You may want to increase limits or disable rate limiting for testing
- Rate limiting is still active in development mode

## Troubleshooting

### Rate limits too strict
- Increase the `RL_*_MAX` values in your `.env` file
- Restart the server after changing environment variables

### Rate limits not working correctly behind proxy
- Verify `TRUST_PROXY=1` is set
- Check that your reverse proxy forwards `X-Forwarded-For` header

### All requests show same IP
- This happens when `TRUST_PROXY` is not set correctly
- Ensure `TRUST_PROXY=1` when behind a reverse proxy
