# Vendored third-party scripts

## html2canvas-pro.min.js
- Version: 1.6.4 (pinned — must match `H2C_CDN_URL` in `public/widget.js`)
- Source: npm `html2canvas-pro@1.6.4` → `dist/html2canvas-pro.min.js` (MIT)
- SHA-256: `a22c64bd604285c86bc8d32917bc052dd307ae61962ed6c49ad7af4e362362fd`
- Why vendored: the widget loads it from same origin instead of jsdelivr —
  removes a third-party supply-chain dependency and an ad-blocker failure mode.
  The CDN URL stays in widget.js only as a fallback for older self-hosted
  instances that updated widget.js without adding this directory.

To update: bump the version in both places, re-download from the npm tarball
(`registry.npmjs.org`), and record the new SHA-256 here.
