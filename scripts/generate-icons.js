const fs = require('fs');
const path = require('path');

// Simple SVG icon with green checkmark theme
const createSvgIcon = (size) => `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="#2da44e"/>
  <text x="50%" y="55%" text-anchor="middle" dominant-baseline="middle"
        font-size="${size * 0.5}" font-family="Arial, sans-serif" fill="white">✓</text>
</svg>`;

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const iconsDir = path.join(__dirname, '..', 'public', 'icons');

// Create icons directory
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Generate SVG icons for each size
sizes.forEach(size => {
  const svg = createSvgIcon(size);
  const filename = path.join(iconsDir, `icon-${size}x${size}.svg`);
  fs.writeFileSync(filename, svg);
  console.log(`Created: icon-${size}x${size}.svg`);
});

console.log('\\nSVG icons created. For PNG conversion, use an online tool or install ImageMagick.');
