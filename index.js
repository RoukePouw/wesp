const fs = require('fs');
const {exec} = require('child_process');
const glob = require('glob');
const chokidar = require('chokidar');

/**
 * Callback 
 *
 * @name Callback
 * @function
 */

/**
 * Execute multiple actions sequentially
 *
 * @param {...Function} actions - steps
 * @returns {Callback}
 */
const series = (...actions) => function (cb) {
  if (actions.length === 0) cb();
  else {
    let functionName = actions[0].toString()
      .substr('function '.length);
    functionName = functionName.substr(0, functionName.indexOf('('));
    message(functionName);
    actions[0](() => {
      const a = actions.slice(1);
      series(...a)(cb);
    });
  }
};
exports.series = series;

/**
 * Execute multiple actions simultaniously
 *
 * @param {...Function} actions
 * @returns {Callback}
 */
const parallel = (...actions) => function (cb) {
  if (actions.length === 0) cb();
  else {
    const done = new Set();
    /**
     *
     * @param action
     */
    function markDone (action) {
      done.add(action);
      if (done.size === actions.length) cb();
    }

    for (const action of actions) {
      let functionName = action.toString()
        .substr('function '.length);
      functionName = functionName.substr(0, functionName.indexOf('('));
      message(functionName);
      /**
       *
       */
      async function call () {
        action(() => markDone(action));
      }
      call();
    }
  }
};
exports.parallel = parallel;

const watchers = [];
/** Watch for file changes in given path, fire if changes are detected
 *
 * @param {string|string[]} pattern
 * @param {Function} actions
 * @param action
 */
const onFileChange = function onFileChange (pattern, action) {
  // https://www.npmjs.com/package/chokidar/v/3.0.0
  const watcher = chokidar.watch(pattern, {
    persistent: true,
    ignoreInitial: true,
    followSymlinks: true
  }).on('all', (event, filePath) => {
    message('Starting ' + event + ' detected: ' + filePath + '...');
    action(() => {
      message('Finished ' + filePath);
    });
  });
  watchers.push(watcher);
};
exports.onFileChange = onFileChange;

/**
 * Watch for file changes in given path, fire for each changed and added file
 * @param {string|string[]} pattern
 * @param {Function} actions
 * @param action
 */
exports.onSingleFileChange = function onSingleFileChange (pattern, action) {
  // https://www.npmjs.com/package/chokidar/v/3.0.0
  const watcher = chokidar.watch(pattern, {
    persistent: true,
    ignoreInitial: true,
    followSymlinks: true
  }).on('all', (event, filePath) => {
    message('Starting ' + event + ' detected: ' + filePath + '...');
    if (event === 'change' || event === 'add') {
      action(filePath, event)(() => {
        message('Finished ' + filePath);
      });
    }
  });
  watchers.push(watcher);
};

/**
 * Action to execute on load
 * @param {Function} action
 */
exports.onLoad = action => {
  message('Starting...');

  action(() => {
    message('Finished');
    if (watchers.length > 0) {
      message('Continue watching...');
    }
  });
};

/**
 * /a/b/c.d.e -> c.d
 *
 * @param {string} filePath
 * @returns {string}
 */
exports.getBaseName = function getBaseName (filePath) {
  let base = filePath.substring(filePath.lastIndexOf('/') + 1);
  if (base.lastIndexOf('.') !== -1) { base = base.substring(0, base.lastIndexOf('.')); }
  return base;
};
// TODO dir, extension, filename

const handleError = cb => (error, stdout, stderr) => {
  if (error !== null) console.error(`Error: ${error}\n ${stderr}`);
  cb();
};
/**
 * Execute system command
 * @param {string} command
 * @returns {Callback}
 */
const execute = command => function execute (cb) {
  exec(command, handleError(cb));
};
exports.execute = execute;
/**
 * Create a (nested) directory
 * @param {string} dirPath
 * @returns {Callback}
 */
exports.mkDir = function mkDir (dirPath) { return execute(`mkdir -p ${dirPath};`); };

/**
 * Execute an action for each file mathcing pattern
 * @param {string|string{}} pattern
 * @param {Function} action - // action = ({path,contents}) => cb => {}
 * @returns {Callback}
 */
exports.forEachFile = (pattern, action) => function forEachFile (cb) {
  const subPatterns = typeof pattern === 'string' ? [pattern] : pattern;
  let count = 0;
  const mergeCb = () => {
    ++count;
    if (count === subPatterns.length) cb();
  };
  const cwd = process.cwd();
  for (const subPattern of subPatterns) {
    glob(cwd + '/' + subPattern, {}, function (error, filePaths) {
      if (error) {
        // TODO
      } else {
        let count2 = 0;
        const mergeCb2 = () => {
          ++count2;
          if (count2 === filePaths.length) mergeCb();
        };

        for (const filePath of filePaths) {
          message('forEachFile: ' + filePath.substr(cwd.length));
          fs.readFile(filePath, {}, (error, data) => {
            const file = {
              path: filePath,
              contents: data
            };
            action(file)(mergeCb2);
          });
        }
      }
    });
  }
};
/**
 * Write content to file
 * @param {string} path
 * @param {string} content
 * @returns {Callback}
 */
exports.write = (path, content) => function write (cb) {
  fs.writeFile(path, content, handleError(cb));
};
/**
 * Read content from file
 * @param {string} path
 * @returns {Callback} content
 */
exports.read = path => function read (cb) {
  fs.readFile(path, (error, stdout, stderr) => {
    if (error !== null) console.error(`Error: ${error}\n ${stderr}`);
    cb(stdout.toString());
  });
};

const padd = x => x < 10 ? '0' + x : x;
/**
 *
 * @param {string} string
 */
function message (string) {
  const now = new Date();
  console.log('[' + padd(now.getHours()) + ':' + padd(now.getMinutes()) + ':' + padd(now.getSeconds()) + '] ' + string);
}
exports.message = message;

/**
 * Check if on set of files is newer than other set of files, execute action if so
 * @param {string|string[]} path0
 * @param {string|string[]} path1
 * @param {Function} action
 * @returns {Callback}
 */
exports.ifNewerThan = (path0, path1, action) => function ifNewerThan (cb) {
  if (typeof path0 === 'string') path0 = [path0];
  if (typeof path1 === 'string') path1 = [path1];
  let done = false;
  const totalPatterns = [path0.length, path1.length];
  const countPatterns = [0, 0];
  const totalFiles = [0, 0];
  const countFiles = [0, 0];
  const maxCTime = [-Infinity, -Infinity];

  const finalize = () => {
    if (done) return;
    done = true;
    if (maxCTime[0] > maxCTime[1]) action(cb);
    else cb();
  };
  const handleGlob = i => (error, filePaths) => {
    if (done) return;
    ++countPatterns[i];
    totalFiles[i] += filePaths.length;
    for (const filePath of filePaths) {
      fs.stat(filePath, (error, stats) => {
        if (done) return;
        maxCTime[i] = Math.max(stats.ctime, maxCTime[i]);
        ++countFiles[i];
        if (countPatterns[1] === totalPatterns[1] && totalFiles[1] === countFiles[1]) { // path1 has been fully checked
          if (maxCTime[0] > maxCTime[1]) { // short circuit, already done
            finalize();
          } else {
            if (countPatterns[0] === totalPatterns[0] && totalFiles[0] === countFiles[0]) { // path0 has also been done
              finalize();
            }
          }
        }
      });
    }
  };
  for (const pattern of path0) glob(pattern, handleGlob(0));
  for (const pattern of path1) glob(pattern, handleGlob(1));
};

/**
 * Reload wesp process when wesp code has been changed
 */
function reload(){
  //the shell script will take this exit code to reload
  process.exit(3);
}
exports.reload = reload

onFileChange('./wesp.js', reload)