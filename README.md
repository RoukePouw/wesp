# wesp
Execute actions on file changes.

## Install 
```sh
npm install wesp --save-dev
```

## Setup

Create a `wesp.js` file:

```javascript
// wesp.js
const wesp = require('wesp');

wesp.onLoad( () => console.log('Bzzz') );
```

## Use

```sh
$ wesp
```
(if wesp has been installed globally `npm install wesp -g`, otherwise use `./node_modules/bin/wesp`)

Result
```
[20:59:06] Starting...
Bzzz
```

To run once without continuing to watch files use:
```sh
$ wesp --continue-watching=false
```

By default wesp looks for a `wesp.js` file in the current directory. To use a different file use:
```sh
$ wesp /my/path/file.js
```


## API

The following methods can be used in your `wesp.js` file to define your workflow:

```javascript
// Watch for file changes (fire once per grouped changes)
wesp.onFileChange('myfolder/*.js', () => console.log('Bzzz') );

// Watch for file changes (fire for each changed and added file)
wesp.onSingleFileChange('myfolder/*.js', filePath => console.log('Bzzz', filePath) );

// Execute actions sequentially
wesp.onFileChange('myfolder/*.js', 
    series(
        callback => {console.log('Bzzz'); callback();},
        callback => {console.log('Bzzz'); callback();},
    )
);

// Execute actions simultaniously
wesp.onFileChange('myfolder/*.js', 
    parallel(
        callback => {console.log('Bzzz'); callback();},
        callback => {console.log('Bzzz'); callback();},
    )
);

// Execute action for all files
wesp.forEachFile(
    'myfolder/*.js', 
    (path, content) => callback => { console.log(path,content); callback();}
);

// Execute action only if one set of files is newer than other set of files
wesp.ifNewerThan(
    'myfolder/*.js',
    'otherfolder/*.txt', 
    callback => {console.log('Bzzz'); callback();} 
);
 
wesp.onFileChange('file1.txt', // Monitor for file changes
  series(
   read('file1.txt'), // Read file content
   pipe(content => content + ' hello world'), // Append ' hello world' to content
   read('file2.txt') // Write appended content to second file
  )
);


```




