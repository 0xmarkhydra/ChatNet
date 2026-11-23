import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const specPath = path.join(root, 'docs/03-interfaces/openapi.json');
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const catalogPath = path.join(root, 'docs/03-interfaces/API_CATALOG.md');
const catalog = fs.readFileSync(catalogPath, 'utf8');

const routePatterns = [
  /(?:HandleFunc|Handle)\("(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) ([^\"]+)"/g,
  /add\("(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)",\s*"([^\"]+)"/g,
];
const sourceRoot = path.join(root, 'backend', 'cmd');
const sourceRoutes = new Set();

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(filename);
    else if (entry.name.endsWith('.go') && !entry.name.endsWith('_test.go')) {
      const source = fs.readFileSync(filename, 'utf8');
      for (const pattern of routePatterns) {
        for (const match of source.matchAll(pattern)) {
          if (match[2].startsWith('/api/')) sourceRoutes.add(`${match[1]} ${match[2]}`);
        }
      }
    }
  }
}

walk(sourceRoot);

// Gateway/service health endpoints are operational checks, not public API contracts.
// Keep them out of route-to-spec and catalog comparisons.
const excludedSourceRoutes = new Set([
  'GET /api/live',
  'GET /api/ready',
]);
const excludedCatalogRoutes = new Set([
  ...excludedSourceRoutes,
  'GET /api/health',
]);

const specRoutes = new Set();
const operationIds = new Set();
for (const [route, operations] of Object.entries(spec.paths ?? {})) {
  for (const [method, operation] of Object.entries(operations)) {
    if (!['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(method)) continue;
    specRoutes.add(`${method.toUpperCase()} ${route}`);
    if (!operation.operationId) throw new Error(`missing operationId: ${method.toUpperCase()} ${route}`);
    if (operationIds.has(operation.operationId)) throw new Error(`duplicate operationId: ${operation.operationId}`);
    operationIds.add(operation.operationId);
    for (const name of route.matchAll(/\{([^}]+)\}/g)) {
      const parameters = operation.parameters ?? [];
      if (!parameters.some((parameter) => parameter.in === 'path' && parameter.name === name[1] && parameter.required === true)) {
        throw new Error(`missing required path parameter ${name[1]}: ${method.toUpperCase()} ${route}`);
      }
    }
    if (operation['x-chatnet-contract-status'] === 'verified') {
      if (!operation['x-source']) throw new Error(`verified operation missing x-source: ${method.toUpperCase()} ${route}`);
      if (operation.responses?.default) throw new Error(`verified operation has default response: ${method.toUpperCase()} ${route}`);
      if (!operation.responses || Object.keys(operation.responses).length === 0) {
        throw new Error(`verified operation has no responses: ${method.toUpperCase()} ${route}`);
      }
    }
  }
}

const missing = [...sourceRoutes]
  .filter((route) => !excludedSourceRoutes.has(route) && !specRoutes.has(route))
  .sort();
const stale = [...specRoutes]
  .filter((route) => !excludedSourceRoutes.has(route) && !sourceRoutes.has(route))
  .sort();
if (missing.length || stale.length) {
  if (missing.length) console.error(`Missing OpenAPI routes (${missing.length}):\n${missing.join('\n')}`);
  if (stale.length) console.error(`Stale OpenAPI routes (${stale.length}):\n${stale.join('\n')}`);
  process.exit(1);
}

const catalogRoutes = new Set([...catalog.matchAll(/^\| (GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) \| (\/api\/[^ |]+) \|/gm)]
  .map((match) => `${match[1]} ${match[2]}`));
const missingCatalog = [...sourceRoutes]
  .filter((route) => !excludedCatalogRoutes.has(route) && !catalogRoutes.has(route))
  .sort();
const staleCatalog = [...catalogRoutes]
  .filter((route) => !excludedCatalogRoutes.has(route) && !sourceRoutes.has(route))
  .sort();
if (missingCatalog.length || staleCatalog.length) {
  if (missingCatalog.length) console.error(`Missing catalog routes (${missingCatalog.length}):\n${missingCatalog.join('\n')}`);
  if (staleCatalog.length) console.error(`Stale catalog routes (${staleCatalog.length}):\n${staleCatalog.join('\n')}`);
  process.exit(1);
}

const inventory = Object.keys(spec.paths).flatMap((route) => Object.values(spec.paths[route])
  .filter((operation) => operation && operation['x-chatnet-contract-status'] === 'route-inventory'));
const verified = Object.keys(spec.paths).flatMap((route) => Object.values(spec.paths[route])
  .filter((operation) => operation && operation['x-chatnet-contract-status'] === 'verified'));
const comparableSourceRouteCount = [...sourceRoutes].filter((route) => !excludedSourceRoutes.has(route)).length;
console.log(`PASS: source, catalog, and OpenAPI routes match (${comparableSourceRouteCount}); excluded internal health=${excludedSourceRoutes.size}; verified=${verified.length}; route-inventory=${inventory.length}`);
