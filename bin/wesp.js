#!/usr/bin/env node

const {execSync} = require('child_process');
const {existsSync, readFileSync} = require('fs');

const argv = process.argv.slice(2);
if (argv.includes('--help') || argv.includes('-h') || argv.includes('-?')) {
  console.log(`usage: wesp [--continue-watching=false] [--help] [--version]
  
  Execute actions on file changes
  
  --continue-watching   Keep process running and watching files
  
  `);
  process.exit(0);
} else if (argv.includes('--version') || argv.includes('-v')) {
  const splitPath = process.argv[1].split('/');
  const packageJsonPath = splitPath.slice(0, splitPath.length - 2).join('/') + '/package.json';
  const version = JSON.parse(readFileSync(packageJsonPath)).version;
  console.log(version);
  process.exit(0);
}

if (!existsSync('./wesp.js')) {
  console.error('No wesp.js file found in ' + process.cwd());
  process.exit(1);
}

let exitCode = 3;
while (exitCode === 3) {
  try {
    execSync('node ./wesp.js ' + argv.join(' '), {stdio: ['ignore', process.stdout, process.stderr]});
    exitCode = 0;
  } catch (error) {
    exitCode = error.status;
  }
}
process.exit(exitCode);
