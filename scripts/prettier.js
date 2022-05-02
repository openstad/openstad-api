const npm = require('npm-commands');

let args = '';
if (process.argv.length == 2) {
  args = '-- src/**/*.js';
}

let command = 'prettier:bare ' + args;
npm().cwd('.').output(true).run(command);
