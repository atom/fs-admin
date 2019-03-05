const fs = require('fs')
const { spawn } = require('child_process')
const EventEmitter = require('events')
const binding = require('./build/Release/fs_admin.node')
const fsAdmin = module.exports

fsAdmin.testMode = false

switch (process.platform) {
  case 'darwin':
    Object.assign(fsAdmin, {
      clearAuthorizationCache () {
        binding.clearAuthorizationCache()
      },

      createWriteStream (filePath) {
        let authopen

        // Prompt for credentials synchronously to avoid creating multiple simultaneous prompts.
        if (!binding.spawnAsAdmin('/bin/echo', [], fsAdmin.testMode, () => {})) {
          const result = new EventEmitter()
          result.write = result.end = function () {}
          process.nextTick(() => result.emit('error', new Error('Failed to obtain credentials')))
          return result
        }

        if (fsAdmin.testMode) {
          authopen = spawn('/bin/dd', ['of=' + filePath])
        } else {
          authopen = spawn('/usr/libexec/authopen', ['-extauth', '-w', '-c', filePath])
          authopen.stdin.write(binding.getAuthorizationForm())
        }

        const result = new EventEmitter()

        result.write = (chunk, encoding, callback) => {
          authopen.stdin.write(chunk, encoding, callback)
        }

        result.end = (callback) => {
          if (callback) result.on('finish', callback)
          authopen.stdin.end()
        }

        authopen.on('exit', (exitCode) => {
          if (exitCode !== 0) {
            result.emit('error', new Error('authopen exited with code ' + exitCode))
          }
          result.emit('finish')
        })

        return result
      },

      symlink (target, filePath, callback) {
        binding.spawnAsAdmin(
          '/bin/ln',
          ['-s', target, filePath],
          fsAdmin.testMode,
          wrapCallback('ln', callback)
        )
      },

      unlink (filePath, callback) {
        binding.spawnAsAdmin(
          '/bin/rm',
          ['-rf', filePath],
          fsAdmin.testMode,
          wrapCallback('rm', callback)
        )
      },

      makeTree (directoryPath, callback) {
        binding.spawnAsAdmin(
          '/bin/mkdir',
          ['-p', directoryPath],
          fsAdmin.testMode,
          wrapCallback('mkdir', callback)
        )
      },

      recursiveCopy (sourcePath, destinationPath, callback) {
        binding.spawnAsAdmin(
          '/bin/rm',
          ['-r', '-f', destinationPath],
          fsAdmin.testMode,
          wrapCallback('rm', (error) => {
            if (error) return callback(error)
            binding.spawnAsAdmin(
              '/bin/cp',
              ['-r', sourcePath, destinationPath],
              fsAdmin.testMode,
              wrapCallback('cp', callback)
            )
          })
        )
      }
    })
    break

  case 'win32':
    Object.assign(fsAdmin, {
      symlink (target, filePath, callback) {
        binding.spawnAsAdmin(
          'cmd',
          ['/c', 'mklink', '/j', filePath, target],
          fsAdmin.testMode,
          wrapCallback('mklink', callback)
        )
      },

      unlink (filePath, callback) {
        fs.stat(filePath, (error, status) => {
          if (error) return callback(error)
          if (status.isDirectory()) {
            binding.spawnAsAdmin(
              'cmd',
              ['/c', 'rmdir', '/s', '/q', filePath],
              fsAdmin.testMode,
              wrapCallback('rmdir', callback)
            )
          } else {
            binding.spawnAsAdmin(
              'cmd',
              ['/c', 'del', '/f', '/q', filePath],
              fsAdmin.testMode,
              wrapCallback('del', callback)
            )
          }
        })
      },

      makeTree (directoryPath, callback) {
        binding.spawnAsAdmin(
          'cmd',
          ['/c', 'mkdir', directoryPath],
          fsAdmin.testMode,
          wrapCallback('mkdir', callback)
        )
      },

      recursiveCopy (sourcePath, destinationPath, callback) {
        binding.spawnAsAdmin(
          'cmd',
          ['/c', require.resolve('./src/copy-folder.cmd'), sourcePath, destinationPath],
          fsAdmin.testMode,
          wrapCallback('robocopy', callback)
        )
      }
    })
    break
}

function wrapCallback (commandName, callback) {
  return (exitCode) => callback(
    exitCode === 0
      ? null
      : new Error(commandName + ' failed with exit status ' + exitCode)
  )
}
