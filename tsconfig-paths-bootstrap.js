// This file registers tsconfig paths for production
const path = require('path');
const tsConfig = require('./tsconfig.json');
const tsConfigPaths = require('tsconfig-paths');

const baseUrl = __dirname; // Project root
const paths = {};

// Convert TypeScript paths to JavaScript paths
if (tsConfig.compilerOptions?.paths) {
  Object.keys(tsConfig.compilerOptions.paths).forEach(alias => {
    const originalPaths = tsConfig.compilerOptions.paths[alias];
    paths[alias] = originalPaths.map(p => p.replace('src/', 'dist/'));
  });
}

console.log('Registering tsconfig paths:', { baseUrl, paths });

tsConfigPaths.register({
  baseUrl,
  paths
});