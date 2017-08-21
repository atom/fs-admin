const fs = require('fs')
const {spawn} = require('child_process')
const EventEmitter = require('events')
const temp = require('temp')
const binding = require('./build/Release/fs_admin.node')

module.exports.testMode = false;

switch (process.platform) {
  case 'darwin': {
    class WriteStream extends EventEmitter {
      constructor (childProcess) {
        super()
        this.childProcess = childProcess
        this.childProcess.on('error', (error) => this.emit('error', error))
        this.childProcess.on('exit', (exitCode) => {
          if (exitCode !== 0) {
            this.emit('error', new Error(`Authopen failed with exit code: ${exitCode}`))
          }
          this.emit('end')
        })
      }

      write (chunk, encoding, callback) {
        this.childProcess.stdin.write(chunk, encoding, callback)
      }

      end (callback) {
        if (callback) this.on('end', callback)
        this.childProcess.stdin.end()
      }
    }

    module.exports.createWriteStream = function (filePath) {
      let authopen;
      if (module.exports.testMode) {
        authopen = spawn('/bin/dd', ['of=' + filePath])
      } else {
        authopen = spawn('/usr/libexec/authopen', ['-extauth', '-w', '-c', filePath], {
          stdio: ['pipe', 'inherit', 'inherit']
        })
        authopen.stdin.write(binding.getAuthorizationForm())
      }
      return new WriteStream(authopen)
    }

    module.exports.symlink = function (target, filePath, callback) {
      binding.spawnAsAdmin(
        '/bin/ln',
        ['-s', target, filePath],
        module.exports.testMode,
        wrapCallback('ln', callback)
      )
    }

    module.exports.unlink = function (filePath, callback) {
      binding.spawnAsAdmin(
        '/bin/rm',
        ['-rf', filePath],
        module.exports.testMode,
        wrapCallback('rm', callback)
      )
    }

    module.exports.recursiveCopy = function (sourcePath, destinationPath, callback) {
      binding.spawnAsAdmin(
        '/bin/rm',
        ['-r', '-f', destinationPath],
        module.exports.testMode,
        wrapCallback('rm', (error) => {
          if (error) return callback(error)
          binding.spawnAsAdmin(
            '/bin/cp',
            ['-r', sourcePath, destinationPath],
            module.exports.testMode,
            wrapCallback('cp', callback)
          )
        })
      )
    }

    break
  }

  case 'win32': {
    class WriteStream extends EventEmitter {
      constructor (fd, tempPath, destinationPath) {
        super()
        this.tempPath = tempPath
        this.destinationPath = destinationPath
        this.writeStream = fs.createWriteStream(null, {fd: fd})
      }

      write (chunk, encoding, callback) {
        this.writeStream.write(chunk, encoding, callback)
      }

      end (callback) {
        if (callback) this.on('end', callback)
        this.writeStream.end(() => {
          binding.spawnAsAdmin(
            'cmd',
            ['/c', 'move', this.tempPath, this.destinationPath],
            module.exports.testMode,
            (exitCode) => {
              if (exitCode !== 0) {
                this.emit('error', new Error('move failed with exit code ' + exitCode))
              }
              this.emit('end')
            }
          )
        })
      }
    }

    module.exports.createWriteStream = function (filePath) {
      const {fd, path} = temp.openSync('fs-admin-write')
      return new WriteStream(fd, path, filePath)
    }

    module.exports.symlink = function (target, filePath, callback) {
      binding.spawnAsAdmin(
        'cmd',
        ['/c', 'mklink', '/j', filePath, target],
        module.exports.testMode,
        wrapCallback('mklink', callback)
      )
    }

    module.exports.unlink = function (filePath, callback) {
      fs.stat(filePath, (error, status) => {
        if (error) return callback(error)
        if (status.isDirectory()) {
          binding.spawnAsAdmin(
            'cmd',
            ['/c', 'rmdir', '/s', '/q', filePath],
            module.exports.testMode,
            wrapCallback('rmdir', callback)
          )
        } else {
          binding.spawnAsAdmin(
            'cmd',
            ['/c', 'del', '/f', '/q', filePath],
            module.exports.testMode,
            wrapCallback('del', callback)
          )
        }
      })
    }

    module.exports.recursiveCopy = function (sourcePath, destinationPath, callback) {
      binding.spawnAsAdmin(
        'cmd',
        ['/c', 'rmdir', destinationPath, '/s', '/q'],
        module.exports.testMode,
        wrapCallback('rmdir', (error) => {
          if (error) return callback(error)
          binding.spawnAsAdmin(
            'cmd',
            ['/c', 'robocopy', sourcePath, destinationPath, '/e'],
            module.exports.testMode,
            (exitCode) => {
              if (exitCode >= 8) {
                callback(new Error('robocopy failed with exit status ' + exitCode))
              } else {
                callback()
              }
            }
          )
        })
      )
    }
  }
}

function wrapCallback (commandName, callback) {
  return (exitCode) => callback(
    exitCode === 0 ?
      null :
      new Error(commandName + ' failed with exit status ' + exitCode)
  )
}