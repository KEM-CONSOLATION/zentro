const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

const publicDir = path.join(__dirname, '..', 'public')
const logoPath = path.join(publicDir, 'CountPadi.jpeg')

async function generateFavicons() {
  if (!fs.existsSync(logoPath)) {
    console.error('CountPadi.jpeg not found in public directory')
    process.exit(1)
  }

  console.log('Generating favicon files...')

  const sizes = [
    { name: 'favicon-16x16.png', size: 16 },
    { name: 'favicon-32x32.png', size: 32 },
    { name: 'favicon-48x48.png', size: 48 },
    { name: 'apple-touch-icon.png', size: 180 },
    { name: 'favicon-192x192.png', size: 192 },
    { name: 'favicon-512x512.png', size: 512 },
  ]

  try {
    // Generate PNG files
    for (const { name, size } of sizes) {
      await sharp(logoPath)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        })
        .png()
        .toFile(path.join(publicDir, name))
      console.log(`✓ Generated ${name}`)
    }

    // Generate favicon.ico (combine 16x16, 32x32, 48x48)
    // Note: sharp doesn't support ICO format directly, so we'll use the 32x32 PNG as favicon.ico
    // For proper ICO, use an online tool or imagemagick
    await sharp(logoPath)
      .resize(32, 32, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .toFile(path.join(publicDir, 'favicon.ico'))
    console.log('✓ Generated favicon.ico (using 32x32 PNG)')

    console.log('\n✅ All favicon files generated successfully!')
    console.log('\nNote: For a proper multi-size ICO file, use an online tool like:')
    console.log('https://realfavicongenerator.net/')
  } catch (error) {
    console.error('Error generating favicons:', error)
    process.exit(1)
  }
}

generateFavicons()
