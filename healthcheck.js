const http = require('http');
const https = require('https');

// Determine protocol based on environment
const useHttps = process.env.USE_HTTPS === 'true';
const protocol = useHttps ? https : http;
const defaultPort = useHttps ? 443 : 3000;

const options = {
  hostname: 'localhost',
  port: process.env.PORT || defaultPort,
  path: '/health',
  method: 'GET',
  timeout: 2000
};

// For HTTPS, we might need to ignore self-signed certificates in development
if (useHttps) {
  options.rejectUnauthorized = false;
}

const request = protocol.request(options, (res) => {
  if (res.statusCode === 200) {
    process.exit(0);
  } else {
    process.exit(1);
  }
});

request.on('error', () => {
  process.exit(1);
});

request.on('timeout', () => {
  request.destroy();
  process.exit(1);
});

request.end();