#ifndef SRC_SPAWN_AS_ADMIN_H_
#define SRC_SPAWN_AS_ADMIN_H_

#include <string>
#include <vector>

namespace fs_admin {

std::string CreateAuthorizationForm();

void ClearAuthorizationCacheImpl();

void *StartChildProcess(const std::string &command, const std::vector<std::string> &args, bool test_mode);

int WaitForChildProcessToExit(void *, bool test_mode);

}  // namespace fs_admin

#endif  // SRC_SPAWN_AS_ADMIN_H_
