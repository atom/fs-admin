const fs = require('fs')
const os = require('os')
const path = require('path')
const assert = require('assert')
const temp  = require('temp')
const fsAdmin = require('..')

// Comment this out to test with actual privilege escalation.
fsAdmin.testMode = true

if (process.platform !== 'win32' && process.platform !== 'darwin') {
  process.exit(0)
}

describe('fs-admin', function () {
  let dirPath, filePath

  beforeEach(() => {
    dirPath = temp.mkdirSync('fs-admin-test')
    filePath = path.join(dirPath, 'file')
  })

  // Allow enough time for typing credentials
  if (!fsAdmin.testMode) this.timeout(10000)

  describe('createWriteStream', () => {
    it('writes to the given file as the admin user', (done) => {
      fs.writeFileSync(filePath, '')

      if (!fsAdmin.testMode) {
        fs.chmodSync(filePath, 0444)
        assert.throws(() => fs.writeFileSync(filePath, 'hi'), /EACCES|EPERM/)
      }

      fs.createReadStream(__filename)
        .pipe(fsAdmin.createWriteStream(filePath))
        .on('end', () => {
          assert.equal(fs.readFileSync(filePath, 'utf8'), fs.readFileSync(__filename, 'utf8'))
          done()
        })
    })
  })

  describe('unlink', () => {
    it('deletes the given file as the admin user', (done) => {
      fs.writeFileSync(filePath, '')

      if (!fsAdmin.testMode) {
        fs.chmodSync(path.dirname(filePath), 0444)
        assert.throws(() => fs.unlinkSync(filePath, 'hi'), /EACCES|EPERM/)
      }

      fsAdmin.unlink(filePath, (error) => {
        assert.equal(error, null)
        assert(!fs.existsSync(filePath))
        done()
      })
    })
  })

  describe('symlink', () => {
    it('creates a symlink at the given path as the admin user', (done) => {
      fsAdmin.symlink(__filename, filePath, (error) => {
        assert.equal(error, null)

        if (!fsAdmin.testMode) {
          assert.equal(fs.lstatSync(filePath).uid, 0)
        }

        assert.equal(fs.readFileSync(filePath, 'utf8'), fs.readFileSync(__filename))
        done()
      })
    })
  })

  describe('recursiveCopy', () => {
    it('copies the given folder to the given location as the admin user', (done) => {
      const sourcePath = path.join(dirPath, 'src-dir')
      fs.mkdirSync(sourcePath)
      fs.mkdirSync(path.join(sourcePath, 'dir1'))
      fs.writeFileSync(path.join(sourcePath, 'dir1', 'file1.txt'), '1')
      fs.writeFileSync(path.join(sourcePath, 'dir1', 'file2.txt'), '2')

      const destinationPath = path.join(dirPath, 'dest-dir')
      fs.mkdirSync(destinationPath)
      fs.writeFileSync(path.join(destinationPath, 'other-file.txt'), '3')

      if (!fsAdmin.testMode) {
        fs.chmodSync(destinationPath, 0444)
        assert.throws(() => fs.unlinkSync(destinationPath), /EACCES|EPERM/)
        assert.throws(() => fs.mkdirSync(path.join(destinationPath, 'dir1')), /EACCES|EPERM/)
      }

      fsAdmin.recursiveCopy(sourcePath, destinationPath, (error) => {
        assert.equal(fs.readFileSync(path.join(destinationPath, 'dir1', 'file1.txt')), '1')
        assert.equal(fs.readFileSync(path.join(destinationPath, 'dir1', 'file2.txt')), '2')
        assert(!fs.existsSync(path.join(destinationPath, 'other-file.txt')))
        assert.equal(error, null)
        done()
      })
    })
  })
})