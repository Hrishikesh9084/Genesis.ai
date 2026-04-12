function toFileMap(input, fallbackPrefix = '') {
  if (!input) return {};

  if (Array.isArray(input)) {
    return input.reduce((acc, file, index) => {
      const filePath = String(file?.path || `${fallbackPrefix}file-${index}.txt`).replace(/\\/g, '/');
      acc[filePath] = String(file?.content || '');
      return acc;
    }, {});
  }

  if (typeof input === 'object') {
    return Object.entries(input).reduce((acc, [filePath, content]) => {
      acc[String(filePath).replace(/\\/g, '/')] = String(content ?? '');
      return acc;
    }, {});
  }

  return {};
}

function upsertEnvFile(frontendFiles, key, value) {
  const envPath = frontendFiles['.env.production'] !== undefined ? '.env.production' : '.env';
  const current = String(frontendFiles[envPath] || '');
  const line = `${key}=${value}`;

  if (new RegExp(`^${key}=`, 'm').test(current)) {
    frontendFiles[envPath] = current.replace(new RegExp(`^${key}=.*$`, 'm'), line);
  } else {
    frontendFiles[envPath] = current.trim() ? `${current.trim()}\n${line}\n` : `${line}\n`;
  }
}

function ensurePortConfigInBackend(backendFiles) {
  const candidates = ['index.js', 'server.js', 'src/index.js', 'src/server.js', 'app.js'];

  for (const candidate of candidates) {
    if (!backendFiles[candidate]) continue;
    const content = String(backendFiles[candidate]);

    if (/process\.env\.PORT/.test(content)) {
      return;
    }

    if (/app\.listen\(/.test(content)) {
      backendFiles[candidate] = `const PORT = process.env.PORT || 3000;\n${content}`.replace(
        /app\.listen\(([^,)]+)(,\s*[^)]*)?\)/,
        'app.listen(PORT$2)'
      );
      return;
    }
  }
}

function ensureBackendStartScript(backendFiles) {
  if (!backendFiles['package.json']) return;

  try {
    const pkg = JSON.parse(String(backendFiles['package.json']));
    pkg.scripts = pkg.scripts || {};
    if (!pkg.scripts.start) {
      if (backendFiles['index.js']) pkg.scripts.start = 'node index.js';
      else if (backendFiles['server.js']) pkg.scripts.start = 'node server.js';
      else if (backendFiles['src/index.js']) pkg.scripts.start = 'node src/index.js';
      else pkg.scripts.start = 'node index.js';
    }
    backendFiles['package.json'] = `${JSON.stringify(pkg, null, 2)}\n`;
  } catch {
    // Keep original package.json when parsing fails.
  }
}

export function normalizeProjectFiles(code) {
  const frontendFiles = toFileMap(code?.frontendFiles || code?.frontend || {}, 'frontend/');
  const backendFiles = toFileMap(code?.backendFiles || code?.backend || {}, 'backend/');
  return { frontendFiles, backendFiles };
}

export function connectServices({ frontendFiles, backendFiles, backendUrl }) {
  upsertEnvFile(frontendFiles, 'NEXT_PUBLIC_API_URL', backendUrl);
  ensurePortConfigInBackend(backendFiles);
  ensureBackendStartScript(backendFiles);

  return { frontendFiles, backendFiles };
}
