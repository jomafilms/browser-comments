# Cross-origin captures (CORS)

The feedback widget builds its screenshot with **html2canvas** — it re-renders
the page's DOM to a canvas rather than taking an OS-level screenshot. That keeps
the widget lightweight and dependency-free, but it means the canvas can only read
pixels the browser will let it read.

**The practical effect:** images and other assets served from **another origin**
render **blank** in the capture unless that origin sends permissive CORS headers.
Same-origin assets always capture fine. (Videos, cross-origin iframes, and native
browser UI don't capture regardless of CORS — see the "Known limitations" section
on the landing page.)

If your app serves images/fonts from a CDN or a separate asset domain and you want
them to appear in captures, add CORS headers on **that asset host**.

## Add the headers

### Node.js / Express — allow specific origins (recommended)

```javascript
const allowedOrigins = ['https://your-instance.vercel.app'];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});
```

### Node.js / Express — allow all (simpler, less strict)

```javascript
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});
```

### Nginx

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
    "https://your-instance.vercel.app",
]
# Or, to allow all:
# CORS_ALLOW_ALL_ORIGINS = True
```

### Ruby on Rails

```ruby
# config/application.rb
config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins 'localhost:3000', 'your-instance.vercel.app'
    resource '*', headers: :any, methods: [:get, :options]
  end
end
```

## Security note

Allowing a **specific origin** means only your dev·tix instance can read those
assets cross-origin. Allowing **all origins** (`*`) is simpler but lets any site
read them. Pick what fits your requirements — for images that are already public
this rarely matters.
