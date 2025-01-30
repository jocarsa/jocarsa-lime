const http = require('http');
const fs = require('fs');
const path = require('path');

// Path to the JSON file
const DATA_FILE = path.join(__dirname, 'celdas.json');
const TEMP_DATA_FILE = path.join(__dirname, 'celdas_temp.json');

// Array to store celda data
let celdas = [];

// Load existing celdas from the JSON file if it exists
const loadCeldas = () => {
  if (fs.existsSync(DATA_FILE)) {
    try {
      const data = fs.readFileSync(DATA_FILE, 'utf8');
      celdas = JSON.parse(data);
      console.log(`Loaded ${celdas.length} celdas from ${DATA_FILE}`);
    } catch (err) {
      console.error(`Error reading or parsing ${DATA_FILE}:`, err);
      // Optionally, you can choose to exit the process if data is corrupted
      // process.exit(1);
    }
  } else {
    console.log(`${DATA_FILE} does not exist. Starting with an empty celdas array.`);
  }
};

// Save celdas to the JSON file atomically
const saveCeldas = () => {
  try {
    // Write to a temporary file first
    fs.writeFileSync(TEMP_DATA_FILE, JSON.stringify(celdas, null, 2), 'utf8');
    // Rename the temporary file to the actual data file
    fs.renameSync(TEMP_DATA_FILE, DATA_FILE);
    console.log(`Saved ${celdas.length} celdas to ${DATA_FILE}`);
  } catch (err) {
    console.error(`Error writing to ${DATA_FILE}:`, err);
  }
};

// Load celdas on server start
loadCeldas();

// Set up interval to save celdas every 10 seconds (10000 milliseconds)
const saveInterval = setInterval(saveCeldas, 10000);

// Optional: Save celdas on server shutdown to ensure data is not lost
const gracefulShutdown = () => {
  console.log('Shutting down server. Saving celdas...');
  clearInterval(saveInterval); // Stop the interval to prevent multiple saves
  saveCeldas();
  process.exit();
};

// Handle various shutdown signals
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
process.on('exit', () => {
  console.log('Process exiting. Saving celdas...');
  saveCeldas();
});

// Optional: Handle uncaught exceptions to attempt saving before crash
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  console.log('Saving celdas before exiting...');
  saveCeldas();
  process.exit(1); // Exit the process after handling the exception
});

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
        if (data.x !== undefined && data.y !== undefined && data.color !== undefined) {
          celdas.push(data);
          console.log('Received celda data:', data);
          // Save immediately after adding a new celda
          saveCeldas();
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
    // Serve static files based on the request URL
    const filePath = path.join(__dirname, req.url);
    fs.exists(filePath, (exists) => {
      if (exists && fs.lstatSync(filePath).isFile()) {
        fs.readFile(filePath, (err, content) => {
          if (err) {
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Internal Server Error');
          } else {
            res.writeHead(200, { 'Content-Type': getContentType(filePath) });
            res.end(content);
          }
        });
      } else {
        // Handle 404 Not Found
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
    });
  }
});

// Start the server on port 3000
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});

