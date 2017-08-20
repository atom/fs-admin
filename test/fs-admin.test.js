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
  let filePath

  beforeEach(() => {
    filePath = path.join(temp.mkdirSync('fs-admin-test'), 'file')
  })

  // Allow enough time for typing credentials
  this.timeout(10000)

  describe('createWriteStream', () => {
    it('writes to the given file as the admin user', (done) => {
      fs.writeFileSync(filePath, '')

      if (!fsAdmin.testMode) {
        fs.chmodSync(filePath, 0444)
        assert.throws(() => fs.writeFileSync(filePath, 'hi'), /EACCES/)
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
        fs.chmodSync(filePath, 0444)
        assert.throws(() => fs.writeFileSync(filePath, 'hi'), /EACCES/)
      }

      fs.unlink(filePath, (error) => {
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
})