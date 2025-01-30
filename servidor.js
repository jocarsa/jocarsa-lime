const http = require('http');
const fs = require('fs');
const path = require('path');

// Array to store celda data
const celdas = [];

// Helper function to handle CORS (if needed)
const setCORSHeaders = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); // Allow all origins
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
};

// Helper function to get the content type based on file extension
const getContentType = (filePath) => {
  const extname = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
    '.mp4': 'video/mp4',
    '.woff': 'application/font-woff',
    '.ttf': 'application/font-ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'application/font-otf',
    '.wasm': 'application/wasm'
  };
  return mimeTypes[extname] || 'application/octet-stream';
};

// Create the HTTP server
const server = http.createServer((req, res) => {
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    setCORSHeaders(res);
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/save-cell') {
    let body = '';

    // Collect the data chunks
    req.on('data', chunk => {
      body += chunk.toString();
    });

    // When all data is received
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        // Validate data
        if (data.id && data.color) {
          celdas.push(data);
          console.log('Received celda data:', data);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(celdas));
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'error', message: 'Invalid data format' }));
        }
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', message: 'Invalid JSON' }));
      }
    });
  } else if (req.method === 'GET' && req.url === '/celdas') {
    // Endpoint to retrieve all celdas
    setCORSHeaders(res);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(celdas));
  } else if (req.method === 'GET' && req.url === '/') {
    // Serve index.html on root URL
    const filePath = path.join(__dirname, 'index.html');
    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(content);
      }
    });
  } else {
    // Handle 404 Not Found
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

// Start the server on port 3000
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});

