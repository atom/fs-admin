#include "fs-admin.h"

#include <errno.h>
#include <fcntl.h>
#include <Security/Authorization.h>
#include <sys/wait.h>
#include <stdlib.h>
#include <unistd.h>

namespace fs_admin {

using std::string;
using std::vector;

namespace {

AuthorizationRef authorization_ref = nullptr;

}

AuthorizationRef GetAuthorizationRef() {
  if (!authorization_ref) {
    OSStatus status = AuthorizationCreate(
      NULL,
      kAuthorizationEmptyEnvironment,
      kAuthorizationFlagDefaults,
      &authorization_ref
    );

    if (status != errAuthorizationSuccess) return nullptr;
  }

  return authorization_ref;
}

void ClearAuthorizationCacheImpl() {
  if (authorization_ref) {
    AuthorizationFree(authorization_ref, kAuthorizationFlagDefaults);
    authorization_ref = nullptr;
  }
}

string CreateAuthorizationForm() {
  AuthorizationRef authorization_ref = GetAuthorizationRef();

  AuthorizationExternalForm form;
  OSStatus status = AuthorizationMakeExternalForm(
    authorization_ref,
    &form
  );

  if (status != errAuthorizationSuccess) return {};
  return string(form.bytes, form.bytes + kAuthorizationExternalFormLength);
}

void *StartChildProcess(const string &command, const vector<string> &args, bool test_mode) {
  AuthorizationRef authorization_ref = GetAuthorizationRef();

  vector<char *> argv;
  argv.reserve(args.size());
  for (const string &arg : args) {
    argv.push_back(const_cast<char *>(arg.c_str()));
  }
  argv.push_back(nullptr);

  if (test_mode) {
    int pid = fork();
    switch (pid) {
      case -1:
        return nullptr;

      case 0:
        argv.insert(argv.begin(), const_cast<char *>(command.c_str()));
        execvp(command.c_str(), argv.data());
        abort();

      default:
        int *result = new int;
        *result = pid;
        return result;
    }
  }

  FILE *pipe;

#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
  OSStatus status = AuthorizationExecuteWithPrivileges(
    authorization_ref,
    command.c_str(),
    kAuthorizationFlagDefaults,
    &argv[0],
    &pipe
  );
#pragma clang diagnostic pop

  if (status != errAuthorizationSuccess) return nullptr;
  return pipe;
}

int WaitForChildProcessToExit(void *child_process, bool test_mode) {
  if (test_mode) {
    int *pid_pointer = static_cast<int *>(child_process);
    int pid = *pid_pointer;
    delete pid_pointer;

    int status;
    waitpid(pid, &status, 0);
    return WEXITSTATUS(status);
  }

  char buffer[513];
  auto pipe = static_cast<FILE *>(child_process);
  while (true) {
    size_t bytes_read = fread(buffer, 512, 1, pipe);
    if (bytes_read == 0) break;
    fwrite(buffer, bytes_read, 1, stdout);
    fputs("", stdout);
  }

  fclose(pipe);

  int status;
  wait(&status);
  return WEXITSTATUS(status);
}

}  // namespace fs_admin