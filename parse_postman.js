const fs = require('fs');
const path = require('path');

const postmanPath = path.join(__dirname, '..', 'vlts_client_19-07-2026.postman_collection.json');

try {
  const fileContent = fs.readFileSync(postmanPath, 'utf8');
  const collection = JSON.parse(fileContent);

  console.log(`Collection Name: ${collection.info.name}`);

  const endpoints = [];

  function processItem(item, folderPath = []) {
    if (item.request) {
      const req = item.request;
      // Get URL string
      let rawUrl = '';
      if (req.url) {
        if (typeof req.url === 'string') {
          rawUrl = req.url;
        } else if (req.url.raw) {
          rawUrl = req.url.raw;
        }
      }
      endpoints.push({
        folder: folderPath.join(' -> '),
        name: item.name,
        method: req.method,
        url: rawUrl,
        body: req.body ? req.body.mode : 'none'
      });
    }

    if (item.item && Array.isArray(item.item)) {
      item.item.forEach(subItem => {
        processItem(subItem, [...folderPath, item.name]);
      });
    }
  }

  if (collection.item && Array.isArray(collection.item)) {
    collection.item.forEach(item => processItem(item));
  }

  let output = `Found ${endpoints.length} endpoints in Postman Collection:\n\n`;
  endpoints.forEach((ep, idx) => {
    output += `${idx + 1}. [${ep.method}] ${ep.name}\n`;
    output += `   Path: ${ep.folder}\n`;
    output += `   URL: ${ep.url}\n`;
    output += `   Body Mode: ${ep.body}\n\n`;
  });

  fs.writeFileSync('postman_endpoints.txt', output);
  console.log(`Parsed ${endpoints.length} endpoints successfully! Saved to postman_endpoints.txt.`);
} catch (err) {
  console.error('Error parsing Postman collection:', err);
}
