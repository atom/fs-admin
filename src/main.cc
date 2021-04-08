#include "napi.h"
#include "uv.h"
#include "fs-admin.h"

namespace fs_admin {

using namespace Napi;

class Worker : public Napi::AsyncWorker {
  void *child_process;
  int exit_code;
  bool test_mode;

public:
  Worker(const Napi::Env &env, void *child_process, bool test_mode) :
    Napi::AsyncWorker(env),
    child_process(child_process),
    exit_code(-1),
    test_mode(test_mode) {}

  void Execute() {
    exit_code = WaitForChildProcessToExit(child_process, test_mode);
  }

  void OnOK() {
    Napi::Value argv[] = {Napi::Number::New(env, exit_code)};
    callback->Call(1, argv, async_resource);
  }
};

void GetAuthorizationForm(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  auto auth_form = CreateAuthorizationForm();
  auto buffer = Napi::Buffer::Copy(env, auth_form.c_str(), auth_form.size());
  return buffer;
}

void ClearAuthorizationCache(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  ClearAuthorizationCache();
}

void SpawnAsAdmin(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (!info[0].IsString()) {
    Napi::TypeError::New(env, "Command must be a string").ThrowAsJavaScriptException();
    return env.Null();
  }

  std::string commandNan = info[0].As<Napi::String>();
  std::string command(*commandNan, commandNan.Length());

  if (!info[1].IsArray()) {
    Napi::TypeError::New(env, "Arguments must be an array").ThrowAsJavaScriptException();
    return env.Null();
  }

  Napi::Array js_args = info[1].As<Napi::Array>();
  std::vector<std::string> args;
  args.reserve(js_args->Length());
  for (uint32_t i = 0; i < js_args->Length(); ++i) {
    Local<Context> context = Napi::GetCurrentContext();
    Napi::Value js_arg = js_args->Get(context, i);
    if (!js_arg.IsString()) {
      Napi::TypeError::New(env, "Arguments must be an array of strings").ThrowAsJavaScriptException();
      return env.Null();
    }

    args.push_back(js_arg->As<Napi::String>().Utf8Value().c_str());
  }

  bool test_mode = false;
  if (info[2].IsTrue()) test_mode = true;

  if (!info[3].IsFunction()) {
    Napi::TypeError::New(env, "Callback must be a function").ThrowAsJavaScriptException();
    return env.Null();
  }

  void *child_process = StartChildProcess(command, args, test_mode);
  if (!child_process) {
    return env.False();
  } else {
    new Worker(new Napi::FunctionReference(info[3].As<Napi::Function>()), child_process, test_mode).Queue();
    return env.True();
  }
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set(Napi::String::New(env, "getAuthorizationForm"), Napi::Function::New(env, GetAuthorizationForm));
  exports.Set(Napi::String::New(env, "clearAuthorizationCache"), Napi::Function::New(env, ClearAuthorizationCache));
  exports.Set(Napi::String::New(env, "spawnAsAdmin"), Napi::Function::New(env, SpawnAsAdmin));
}

NODE_API_MODULE(fs_admin, Init)

}  // namespace spawn_as_admin
