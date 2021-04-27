#include "fs-admin.h"

namespace fs_admin {

using std::vector;
using std::string;

void *StartChildProcess(const string &command, const vector<string> &args, bool test_mode) {
  return nullptr;
}

int WaitForChildProcessToExit(void *child_process, bool test_mode) {
  return -1;
}

string CreateAuthorizationForm() { return ""; }
void ClearAuthorizationCacheImpl() {}

}  // namespace fs_admin
