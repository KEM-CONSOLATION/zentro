# Favicon Generation Instructions

To generate proper favicon files from the CountPadi logo, you can use one of these methods:

## Method 1: Using Online Tools (Recommended)

1. Go to https://realfavicongenerator.net/
2. Upload `/public/CountPadi.jpeg`
3. Configure settings:
   - iOS: Use single picture for all iOS devices
   - Android Chrome: Use single picture for all Android devices
   - Windows Metro: Use single picture for all Windows devices
   - macOS Safari: Use single picture for all macOS devices
4. Generate and download the favicon package
5. Extract and place all files in `/public/` directory

## Method 2: Using ImageMagick (Command Line)

```bash
# Install ImageMagick if not installed
# macOS: brew install imagemagick
# Ubuntu: sudo apt-get install imagemagick

cd public

# Generate favicon.ico (16x16, 32x32, 48x48 combined)
convert CountPadi.jpeg -resize 16x16 favicon-16x16.png
convert CountPadi.jpeg -resize 32x32 favicon-32x32.png
convert CountPadi.jpeg -resize 48x48 favicon-48x48.png
convert favicon-16x16.png favicon-32x32.png favicon-48x48.png favicon.ico

# Generate Apple Touch Icon
convert CountPadi.jpeg -resize 180x180 apple-touch-icon.png

# Generate Android Chrome icons
convert CountPadi.jpeg -resize 192x192 favicon-192x192.png
convert CountPadi.jpeg -resize 512x512 favicon-512x512.png
```

## Method 3: Using Node.js (sharp package)

```bash
npm install --save-dev sharp
node scripts/generate-favicons.js
```

## Required Files

After generation, ensure these files exist in `/public/`:
- `favicon.ico` (multi-size ICO file)
- `favicon.svg` (already exists)
- `favicon-16x16.png`
- `favicon-32x32.png`
- `apple-touch-icon.png` (180x180)
- `favicon-192x192.png`
- `favicon-512x512.png`
