#!/usr/bin/env node

const {execSync} = require('child_process');
const {existsSync} = require('fs');

if (!existsSync('./wesp.js')) {
  console.error('No wesp.js file found in ' + process.cwd());
  process.exit(1);
}

let exitCode = 3;
while (exitCode === 3) {
  try {
    execSync('node ./wesp.js ' + process.argv.slice(2).join(' '), {stdio: ['ignore', process.stdout, process.stderr]});
    exitCode = 0;
  } catch (error) {
    exitCode = error.status; // Might be 127 in your example.
  }
}
process.exit(exitCode);
