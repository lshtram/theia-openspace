const fs = require('fs');
const path = require('path');

const libFrontend = path.join(__dirname, '..', 'lib', 'frontend');
const indexHtml = path.join(libFrontend, 'index.html');
const faviconSrc = path.join(__dirname, '..', 'resources', 'favicon.svg');
const faviconDest = path.join(libFrontend, 'favicon.svg');

console.log('Running post-build fixes...');

// Copy favicon.svg
if (fs.existsSync(faviconSrc)) {
    fs.mkdirSync(libFrontend, { recursive: true });
    fs.copyFileSync(faviconSrc, faviconDest);
    console.log('Copied favicon.svg');
}

// Fix index.html
if (fs.existsSync(indexHtml)) {
    let html = fs.readFileSync(indexHtml, 'utf8');
    
    // Replace deprecated meta tag
    html = html.replace(
        /<meta name="apple-mobile-web-app-capable" content="yes">/,
        '  <meta name="mobile-web-app-capable" content="yes">'
    );
    
    // Add favicon link if not present
    if (!html.includes('rel="icon"')) {
        html = html.replace(
            /<title>/,
            '  <link rel="icon" type="image/svg+xml" href="./favicon.svg">\n  <title>'
        );
    }
    
    fs.writeFileSync(indexHtml, html);
    console.log('Fixed index.html');
}

console.log('Post-build complete');
