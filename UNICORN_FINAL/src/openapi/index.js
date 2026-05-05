// C12: OpenAPI schema endpoint (forward-only)
// Serves the OpenAPI YAML for all public endpoints

const fs = require('fs');
const path = require('path');

function openapiHandler(req, res) {
  const yamlPath = path.join(__dirname, 'openapi.yaml');
  res.setHeader('Content-Type', 'application/yaml');
  fs.createReadStream(yamlPath).pipe(res);
}

module.exports = { openapiHandler };