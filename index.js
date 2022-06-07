const fs = require('fs');
const {exec} = require('child_process');
const glob = require('glob');
const chokidar = require('chokidar');
const { exit } = require('process');

/**
 * Callback
 *
 * @name Callback
 * @function
 */

/**
 *
 * @param action
 */
function getActionName (action) {
  let actionName = action.toString();
  if (actionName.startsWith('function ')) {
    actionName = actionName.substr('function '.length);
    actionName = actionName.substr(0, actionName.indexOf('('));
    return actionName;
  }
  return '[anonymous function]';
}

/**
 * Execute multiple actions sequentially
 *
 * @param {...Function} actions - steps
 * @returns {Callback}
 */
const series_ = (...actions) => function series (cb) {
  if (actions.length === 0) cb();
  else {
    message(getActionName(actions[0]));
    actions[0](() => {
      const a = actions.slice(1);
      series_(...a)(cb);
    });
  }
};
exports.series = series_;

/**
 * Execute multiple actions simultaniously
 *
 * @param {...Function} actions
 * @returns {Callback}
 */
const parallel = (...actions) => function parallel (cb) {
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
      message(getActionName(action));
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

const watchActions = [];
const watchers = [];
/**
 * Watch for file changes in given path, fire if changes are detected
 *
 * @param {string|string[]} pattern
 * @param {Function} actions
 * @param action
 * @param persistent
 */
const onFileChange = function onFileChange (pattern, action, persistent = true) {
  // https://www.npmjs.com/package/chokidar/v/3.0.0
  watchActions.push(() => {
    const watcher = chokidar.watch(pattern, {
      persistent: persistent,
      ignoreInitial: true,
      followSymlinks: true
    }).on('all', (event, filePath) => {
      message('Starting ' + event + ' detected: ' + filePath + '...');
      action(() => {
        message('Finished ' + filePath);
      });
    });
    watchers.push(watcher);
  });
};
exports.onFileChange = onFileChange;

/**
 * Watch for file changes in given path, fire for each changed and added file
 *
 * @param {string|string[]} pattern
 * @param {Function} actions
 * @param action
 */
exports.onSingleFileChange = function onSingleFileChange (pattern, action) {
  // https://www.npmjs.com/package/chokidar/v/3.0.0
  watchActions.push(() => {
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
  });
};

const sideLoadActions = [];
/**
 * Add aditional onLoad action
 *
 * @param {Function} action
 */
exports.sideLoad = action => {
  sideLoadActions.push(action);
};
const preLoadActions = [];
/**
 * Add aditional action before onLoad
 *
 * @param {Function} action
 */
exports.preLoad = action => {
  preLoadActions.push(action);
};
const postLoadActions = [];
/**
 * Add aditional action after onLoad
 *
 * @param {Function} action
 */
exports.postLoad = action => {
  postLoadActions.push(action);
};
/**
 * Action to execute on load
 *
 * @param {Function} action
 */
exports.onLoad = action => {
  message('Starting...');

  series_(
    parallel(...preLoadActions),
    parallel(...sideLoadActions, action),
    parallel(...postLoadActions)
  )(() => {
    message('Finished');
    if (watchActions.length > 0) {
      if (process.argv.includes('--continue-watching=false')) {
        exit(0);
      }
      watchActions.forEach(watchAction => watchAction());
      message('Continue watching...');
    }
  });
};

/**
 * '/a/b/c.d.e' -> 'c.d.e'
 *
 * @param {string} filePath
 * @returns {string}
 */
function getFileName (filePath) {
  return filePath.substring(filePath.lastIndexOf('/') + 1);
}
exports.getFileName = getFileName;

/**
 * '/a/b/c.d.e' -> 'c.d'
 *
 * @param {string} filePath
 * @returns {string}
 */
exports.getBaseName = function getBaseName (filePath) {
  const fileName = getFileName(filePath);
  if (fileName.startsWith('.')) { // hidden files '/a/b/.c.d.e' -> '.c.d'
    return fileName.substring(0, fileName.lastIndexOf('.', 1));
  } else if (fileName.lastIndexOf('.') !== -1) { // '/a/b/c.d.e' -> 'c.d'
    return fileName.substring(0, fileName.lastIndexOf('.'));
  }
  // '/a/b/c' -> 'c'
  return fileName;
};

/**
 * '/a/b/c.d.e' -> 'e'
 *
 * @param {string} filePath
 * @returns {string}
 */
exports.getExtension = function getExtension (filePath) {
  const fileName = getFileName(filePath);
  if (fileName.startsWith('.')) { // hidden files '/a/b/.c.d.e' -> '.c.d'
    if (fileName.lastIndexOf('.', 1) !== -1) return fileName.substring(fileName.lastIndexOf('.') + 1); // /a/b/.c.d.e -> e
    return ''; // '/a/b/.c' -> ''
  }
  if (fileName.lastIndexOf('.') !== -1) return fileName.substring(fileName.lastIndexOf('.') + 1); // /a/b/c.d.e -> e
  return ''; // '/a/b/c' -> ''
};

/**
 * '/a/b/c.d.e' -> '/a/b'
 *
 * @param {string} filePath
 * @returns string
 */
exports.getDirPath = function getDirPath (filePath) {
  const split = filePath.split('/');
  return split.slice(0, split.length - 1).join('/');
};

const handleError = cb => (error, stdout, stderr) => {
  if (error !== null) {
    console.error(`Error: ${error}\n ${stderr} \n ${stdout}`);
  }
  cb();
};

/**
 * Execute system command
 *
 * @param {string} command
 * @returns {Callback}
 */
const execute = command => function execute (cb) {
  exec(command, handleError(cb));
};
exports.execute = execute;
/**
 * Create a (nested) directory
 *
 * @param {string} dirPath
 * @returns {Callback}
 */
exports.mkDir = function mkDir (dirPath) { return execute(`mkdir -p ${dirPath};`); };

/**
 * Execute an action for each file mathcing pattern
 *
 * @param {string|string{}} pattern
 * @param {Function} action - // action = ({path,contents}) => cb => {}
 * @returns {Callback}
 */
exports.forEachFile = (pattern, action) => function forEachFile (cb) {
  const subPatterns = typeof pattern === 'string' ? [pattern] : pattern;
  let count = 0;
  let fileTotal = 0;
  const mergeCb = () => {
    ++count;
    if (count === subPatterns.length) {
      if (fileTotal === 0) message('forEachFile: no files found');
      cb();
    }
  };
  const cwd = process.cwd();
  for (const subPattern of subPatterns) {
    glob(cwd + '/' + subPattern, {}, function (error, filePaths) {
      if (error) {
        // TODO
      } else {
        let count2 = 0;
        const mergeCb2 = () => {
          if (count2 === filePaths.length) mergeCb();
        };
        fileTotal += filePaths.length;
        for (const filePath of filePaths) {
          message('forEachFile: ' + filePath.substr(cwd.length));
          fs.readFile(filePath, {}, (error, data) => {
            const file = {
              path: filePath,
              contents: data
            };
            action(file)(() => { ++count2; mergeCb2(); });
          });
        }
        mergeCb2();
      }
    });
  }
};
/**
 * Write content to file
 *
 * @param {string} path
 * @param {string} content
 * @returns {Callback}
 */
exports.write = (path, content) => function write (cb) {
  fs.writeFile(path, content, handleError(cb));
};
/**
 * Read content from file
 *
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
function message (string) { // TODO list of args
  const now = new Date(); // TODO add some colors
  console.log('\x1b[36m' + padd(now.getHours()) + ':' + padd(now.getMinutes()) + ':' + padd(now.getSeconds()) + '\x1b[0m ' + string);
}
exports.message = message;

/**
 * Check if on set of files is newer than other set of files, execute action if so
 *
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
function reload () {
  // the shell script will take this exit code to reload
  process.exit(3);
}
exports.reload = reload;
onFileChange(['./wesp.js', __dirname + '/*'], reload);

/**
 * Throttle the execution of an action
 * throttle(200)(action)
 *
 * @param {number} time - The throttle time in miliseconds
 * @returns {Function}
 */
exports.throttle = time => {
  let lastRunTime = 0;
  let timeout = null;
  return cb => function () {
    const now = Date.now();
    if (now - lastRunTime >= time) {
      lastRunTime = now;
      cb(...arguments);
    } else if (timeout === null) {
      timeout = setTimeout(() => {
        timeout = null;
        lastRunTime = now;
        cb(...arguments);
      }, time - (now - lastRunTime));
    }
  };
};
