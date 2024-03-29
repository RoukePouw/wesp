#!/usr/bin/env node

const { execSync } = require('child_process');
const { existsSync, readFileSync, readlinkSync } = require('fs');

const argv = process.argv.slice(2);

if (argv.includes('--help') || argv.includes('-h') || argv.includes('-?')) {
  console.log(`usage: wesp [wesp.js] [--continue-watching=false] [--help] [--version]
  
  Execute actions on file changes
  
  --continue-watching   Keep process running and watching files
  
  `);
  process.exit(0);
} else if (argv.includes('--version') || argv.includes('-v')) {
  const splitPath = process.argv[1].split('/');
  const packageJsonPath = splitPath.slice(0, splitPath.length - 2).join('/') + '/package.json';
  let version;
  if (existsSync(packageJsonPath)) {
    version = JSON.parse(readFileSync(packageJsonPath)).version;
  } else {
    try {
      const splitPath = readlinkSync(process.argv[1]).split('/');
      const packageJsonPath = splitPath.slice(0, splitPath.length - 2).join('/') + '/package.json';
      version = JSON.parse(readFileSync(packageJsonPath)).version;
    } catch (error) {
      console.error('Failed to determine version');
      process.exit(1);
    }
  }
  console.log(version);
  process.exit(0);
}

let wespFilePath = './wesp.js';
if (argv.length > 0 && !argv[0].startsWith('-')) {
  wespFilePath = argv.shift();
  if (!existsSync(wespFilePath)) {
    console.error('File found ' + wespFilePath);
    process.exit(1);
  }
} else if (!existsSync('./wesp.js')) {
  console.error('No wesp.js file found in ' + process.cwd());
  process.exit(1);
}

let exitCode = 3;
while (exitCode === 3) {
  try {
    execSync('node ' + wespFilePath + ' ' + argv.join(' '), { stdio: ['ignore', process.stdout, process.stderr] });
    exitCode = 0;
  } catch (error) {
    exitCode = error.status;
  }
}
process.exit(exitCode);
