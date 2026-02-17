# CORS Setup for Browser Annotation Tool
https://github.com/jomafilms/browser-comments

## How It Currently Works

The browser annotation tool captures screenshots of your interactive experience to save visual feedback comments.

**Current behavior (cross-origin):**
- Users share their screen when saving a comment
- Browser prompts for permission each time
- Works reliably but requires manual interaction

**Optional enhancement (same-origin/CORS enabled):**
- Automatic screenshot capture with no user interaction
- Instant capture of exact interactive state
- Smoother user experience

## Optional CORS Configuration

If you'd like to enable automatic capture, you can add these HTTP headers to your server responses:

### Option 1: Allow Specific Domains (Recommended)

```javascript
// Node.js/Express example
const allowedOrigins = [
  'https://your-browser-comments-domain.com'
];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
});
```

### Option 2: Allow All Origins (Less Secure)

```javascript
// Node.js/Express example
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
});
```

## Examples for Other Server Types

### Nginx (optional)

```nginx
add_header Access-Control-Allow-Origin "*";
add_header Access-Control-Allow-Methods "GET, OPTIONS";
add_header Access-Control-Allow-Headers "Content-Type";
```

### Apache (.htaccess)

```apache
Header set Access-Control-Allow-Origin "*"
Header set Access-Control-Allow-Methods "GET, OPTIONS"
Header set Access-Control-Allow-Headers "Content-Type"
```

### Django

```python
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:3001",
    "https://your-annotation-tool.vercel.app",
]

# Or allow all
CORS_ALLOW_ALL_ORIGINS = True
```

### Ruby on Rails

```ruby
# config/application.rb
config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins 'localhost:3000', 'localhost:3001', 'your-annotation-tool.vercel.app'
    resource '*', headers: :any, methods: [:get, :options]
  end
end
```

## How to Verify (Optional)

If you implement CORS headers, you'll see this in the browser console when saving a comment:
```
Same-origin iframe detected, using html2canvas...
Successfully captured same-origin iframe
```

Without CORS (current behavior):
```
Using screen capture for cross-origin iframe...
```

## Security Notes

- **Option 1** (specific domains) - only the annotation tool can access your content
- **Option 2** (allow all) - simpler but allows any website to embed your content

Choose the option that fits your security requirements.

## Questions?

Feel free to reach out if you have questions or want to discuss the implementation.
