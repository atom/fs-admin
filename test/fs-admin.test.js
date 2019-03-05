const fs = require('fs')
const path = require('path')
const assert = require('assert')
const temp = require('temp')
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
    if (process.platform !== 'darwin') return

    it('writes to the given file as the admin user', (done) => {
      fs.writeFileSync(filePath, '')

      if (!fsAdmin.testMode) {
        fs.chmodSync(filePath, 0o444)
        assert.throws(() => fs.writeFileSync(filePath, 'hi'), /EACCES|EPERM/)
      }

      fs.createReadStream(__filename)
        .pipe(fsAdmin.createWriteStream(filePath))
        .on('finish', () => {
          assert.strictEqual(fs.readFileSync(filePath, 'utf8'), fs.readFileSync(__filename, 'utf8'))
          done()
        })
    })

    it('does not prompt multiple times when concurrent writes are requested', (done) => {
      fsAdmin.clearAuthorizationCache()

      const filePath2 = path.join(dirPath, 'file2')
      const filePath3 = path.join(dirPath, 'file3')

      fs.writeFileSync(filePath, '')
      fs.writeFileSync(filePath2, '')
      fs.writeFileSync(filePath3, '')

      if (!fsAdmin.testMode) {
        fs.chmodSync(filePath, 0o444)
        fs.chmodSync(filePath2, 0o444)
        fs.chmodSync(filePath3, 0o444)
        assert.throws(() => fs.writeFileSync(filePath, 'hi'), /EACCES|EPERM/)
        assert.throws(() => fs.writeFileSync(filePath2, 'hi'), /EACCES|EPERM/)
        assert.throws(() => fs.writeFileSync(filePath3, 'hi'), /EACCES|EPERM/)
      }

      Promise.all([filePath, filePath2, filePath3].map((filePath) =>
        new Promise((resolve) =>
          fs.createReadStream(__filename)
            .pipe(fsAdmin.createWriteStream(filePath))
            .on('finish', () => {
              assert.strictEqual(fs.readFileSync(filePath, 'utf8'), fs.readFileSync(__filename, 'utf8'))
              resolve()
            })
        )
      )).then(() => done())
    })
  })

  describe('makeTree', () => {
    it('creates a directory at the given path as the admin user', (done) => {
      const pathToCreate = path.join(dirPath, 'dir1', 'dir2', 'dir3')

      fsAdmin.makeTree(pathToCreate, (error) => {
        assert.strictEqual(error, null)
        const stats = fs.statSync(pathToCreate)
        assert(stats.isDirectory())

        if (process.platform === 'darwin' && !fsAdmin.testMode) {
          assert.strictEqual(stats.uid, 0)
        }

        done()
      })
    })
  })

  describe('unlink', () => {
    it('deletes the given file as the admin user', (done) => {
      fs.writeFileSync(filePath, '')

      if (!fsAdmin.testMode) {
        fs.chmodSync(filePath, 0o444)
        fs.chmodSync(path.dirname(filePath), 0o444)
        assert.throws(() => fs.unlinkSync(filePath), /EACCES|EPERM/)
      }

      fsAdmin.unlink(filePath, (error) => {
        assert.strictEqual(error, null)
        assert(!fs.existsSync(filePath))
        done()
      })
    })

    it('deletes the given directory as the admin user', (done) => {
      fs.mkdirSync(filePath)

      if (!fsAdmin.testMode) {
        fs.chmodSync(filePath, 0o444)
        fs.chmodSync(path.dirname(filePath), 0o444)
        assert.throws(() => fs.unlinkSync(filePath), /EACCES|EPERM/)
      }

      fsAdmin.unlink(filePath, (error) => {
        assert.strictEqual(error, null)
        assert(!fs.existsSync(filePath))
        done()
      })
    })
  })

  describe('symlink', () => {
    it('creates a symlink at the given path as the admin user', (done) => {
      fsAdmin.symlink(__filename, filePath, (error) => {
        assert.strictEqual(error, null)

        if (!fsAdmin.testMode) {
          assert.strictEqual(fs.lstatSync(filePath).uid, 0)
        }

        assert.strictEqual(fs.readFileSync(filePath, 'utf8'), fs.readFileSync(__filename, 'utf8'))
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
        fs.writeFileSync(path.join(destinationPath, 'something'), '')
        fs.chmodSync(path.join(destinationPath, 'something'), 0o444)
        assert.throws(() => fs.unlinkSync(destinationPath), /EACCES|EPERM/)
      }

      fsAdmin.recursiveCopy(sourcePath, destinationPath, (error) => {
        assert.strictEqual(fs.readFileSync(path.join(destinationPath, 'dir1', 'file1.txt'), 'utf8'), '1')
        assert.strictEqual(fs.readFileSync(path.join(destinationPath, 'dir1', 'file2.txt'), 'utf8'), '2')
        assert(!fs.existsSync(path.join(destinationPath, 'other-file.txt')))
        assert.strictEqual(error, null)
        done()
      })
    })

    it('works when there is nothing at the destination path', (done) => {
      const sourcePath = path.join(dirPath, 'src-dir')
      fs.mkdirSync(sourcePath)
      fs.mkdirSync(path.join(sourcePath, 'dir1'))
      fs.writeFileSync(path.join(sourcePath, 'dir1', 'file1.txt'), '1')
      fs.writeFileSync(path.join(sourcePath, 'dir1', 'file2.txt'), '2')

      const destinationPath = path.join(dirPath, 'dest-dir')

      fsAdmin.recursiveCopy(sourcePath, destinationPath, (error) => {
        assert.strictEqual(fs.readFileSync(path.join(destinationPath, 'dir1', 'file1.txt'), 'utf8'), '1')
        assert.strictEqual(fs.readFileSync(path.join(destinationPath, 'dir1', 'file2.txt'), 'utf8'), '2')
        assert.strictEqual(error, null)
        done()
      })
    })
  })
})
