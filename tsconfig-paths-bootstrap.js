// This file registers tsconfig paths for production
const tsConfig = require('./tsconfig.json');
const tsConfigPaths = require('tsconfig-paths');

const baseUrl = './dist'; // Base URL for compiled JavaScript
const paths = {};

// Convert TypeScript paths to JavaScript paths
if (tsConfig.compilerOptions?.paths) {
  Object.keys(tsConfig.compilerOptions.paths).forEach(alias => {
    const originalPaths = tsConfig.compilerOptions.paths[alias];
    paths[alias] = originalPaths.map(p => p.replace('src', 'dist'));
  });
}

tsConfigPaths.register({
  baseUrl,
  paths
});