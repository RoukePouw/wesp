#!/usr/bin/env node

const {execSync} = require('child_process');

/* TODO
if [ ! -e "./wesp.js" ]; then
    echo "No wesp.js file found in $(pwd)"
    exit 1
fi
*/

let exitCode = 0;
while (exitCode !== 3) {
  try {
    execSync('node ./wesp.js');
  } catch (error) {
    exitCode = error.status; // Might be 127 in your example.
  }
}
process.exit(exitCode);
