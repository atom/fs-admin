#include "nan.h"
#include "fs-admin.h"

namespace fs_admin {

using namespace v8;

class Worker : public Nan::AsyncWorker {
  void *child_process;
  int exit_code;
  bool test_mode;

public:
  Worker(Nan::Callback *callback, void *child_process, bool test_mode) :
    Nan::AsyncWorker(callback),
    child_process(child_process),
    exit_code(-1),
    test_mode(test_mode) {}

  void Execute() {
    exit_code = WaitForChildProcessToExit(child_process, test_mode);
  }

  void HandleOKCallback() {
    Local<Value> argv[] = {Nan::New<Integer>(exit_code)};
    callback->Call(1, argv, async_resource);
  }
};

void GetAuthorizationForm(const Nan::FunctionCallbackInfo<Value>& info) {
  auto auth_form = CreateAuthorizationForm();
  auto buffer = Nan::CopyBuffer(auth_form.c_str(), auth_form.size());
  info.GetReturnValue().Set(buffer.ToLocalChecked());
}

void ClearAuthorizationCache(const Nan::FunctionCallbackInfo<Value>& info) {
  ClearAuthorizationCache();
}

void SpawnAsAdmin(const Nan::FunctionCallbackInfo<Value>& info) {
  if (!info[0]->IsString()) {
    Nan::ThrowTypeError("Command must be a string");
    return;
  }

  Nan::Utf8String commandNan(info[0]);
  std::string command(*commandNan, commandNan.length());

  if (!info[1]->IsArray()) {
    Nan::ThrowTypeError("Arguments must be an array");
    return;
  }

  Local<Array> js_args = Local<Array>::Cast(info[1]);
  std::vector<std::string> args;
  args.reserve(js_args->Length());
  for (uint32_t i = 0; i < js_args->Length(); ++i) {
    Local<Context> context = Nan::GetCurrentContext();
    Local<Value> js_arg = js_args->Get(context, i).ToLocalChecked();
    if (!js_arg->IsString()) {
      Nan::ThrowTypeError("Arguments must be an array of strings");
      return;
    }

    args.push_back(*Nan::Utf8String(js_arg));
  }

  bool test_mode = false;
  if (info[2]->IsTrue()) test_mode = true;

  if (!info[3]->IsFunction()) {
    Nan::ThrowTypeError("Callback must be a function");
    return;
  }

  void *child_process = StartChildProcess(command, args, test_mode);
  if (!child_process) {
    info.GetReturnValue().Set(Nan::False());
  } else {
    Nan::AsyncQueueWorker(new Worker(new Nan::Callback(info[3].As<Function>()), child_process, test_mode));
    info.GetReturnValue().Set(Nan::True());
  }
}

NAN_MODULE_INIT(Init) {
  Nan::SetMethod(target, "getAuthorizationForm", GetAuthorizationForm);
  Nan::SetMethod(target, "clearAuthorizationCache", ClearAuthorizationCache);
  Nan::SetMethod(target, "spawnAsAdmin", SpawnAsAdmin);
}

#if NODE_MAJOR_VERSION >= 10
NAN_MODULE_WORKER_ENABLED(fs_admin, Init)
#else
NODE_MODULE(fs_admin, Init)
#endif

}  // namespace spawn_as_admin
