#include "fs-admin.h"
#include <windows.h>

namespace fs_admin {

using std::string;
using std::vector;

string QuoteCmdArg(const string& arg) {
  if (arg.size() == 0)
    return arg;

  // No quotation needed.
  if (arg.find_first_of(" \t\"") == string::npos)
    return arg;

  // No embedded double quotes or backlashes, just wrap quote marks around
  // the whole thing.
  if (arg.find_first_of("\"\\") == string::npos)
    return string("\"") + arg + '"';

  // Expected input/output:
  //   input : hello"world
  //   output: "hello\"world"
  //   input : hello""world
  //   output: "hello\"\"world"
  //   input : hello\world
  //   output: hello\world
  //   input : hello\\world
  //   output: hello\\world
  //   input : hello\"world
  //   output: "hello\\\"world"
  //   input : hello\\"world
  //   output: "hello\\\\\"world"
  //   input : hello world\
  //   output: "hello world\"
  string quoted;
  bool quote_hit = true;
  for (size_t i = arg.size(); i > 0; --i) {
    quoted.push_back(arg[i - 1]);

    if (quote_hit && arg[i - 1] == '\\') {
      quoted.push_back('\\');
    } else if (arg[i - 1] == '"') {
      quote_hit = true;
      quoted.push_back('\\');
    } else {
      quote_hit = false;
    }
  }

  return string("\"") + string(quoted.rbegin(), quoted.rend()) + '"';
}

void *StartChildProcess(const string &command, const vector<string> &args, bool test_mode) {
  CoInitializeEx(NULL, COINIT_APARTMENTTHREADED | COINIT_DISABLE_OLE1DDE);

  string parameters;
  for (size_t i = 0; i < args.size(); ++i) {
    parameters += QuoteCmdArg(args[i]) + ' ';
  }

  SHELLEXECUTEINFO shell_execute_info = {};
  shell_execute_info.cbSize = sizeof(shell_execute_info);
  shell_execute_info.fMask = SEE_MASK_NOASYNC | SEE_MASK_NOCLOSEPROCESS;
  shell_execute_info.lpVerb = test_mode ? "open" : "runas";
  shell_execute_info.lpFile = command.c_str();
  shell_execute_info.lpParameters = parameters.c_str();
  shell_execute_info.nShow = SW_HIDE;

  if (::ShellExecuteEx(&shell_execute_info) == FALSE || !shell_execute_info.hProcess) {
    return nullptr;
  }

  return shell_execute_info.hProcess;
}

int WaitForChildProcessToExit(void *child_process, bool test_mode) {
  HANDLE process = static_cast<HANDLE>(child_process);
  ::WaitForSingleObject(process, INFINITE);

  DWORD code;
  if (::GetExitCodeProcess(process, &code) == 0) return -1;

  return code;
}

std::string CreateAuthorizationForm() { return ""; }
void ClearAuthorizationCacheImpl() {}

}  // namespace fs_admin
