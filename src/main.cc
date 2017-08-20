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
    callback->Call(1, argv);
  }
};

void GetAuthorizationForm(const Nan::FunctionCallbackInfo<Value>& info) {
  auto auth_form = CreateAuthorizationForm();
  auto buffer = Nan::CopyBuffer(auth_form.c_str(), auth_form.size());
  info.GetReturnValue().Set(buffer.ToLocalChecked());
}

void SpawnAsAdmin(const Nan::FunctionCallbackInfo<Value>& info) {
  if (!info[0]->IsString()) {
    Nan::ThrowTypeError("Command must be a string");
    return;
  }

  std::string command(*String::Utf8Value(info[0]));

  if (!info[1]->IsArray()) {
    Nan::ThrowTypeError("Arguments must be an array");
    return;
  }

  Local<Array> js_args = Local<Array>::Cast(info[1]);
  std::vector<std::string> args;
  args.reserve(js_args->Length());
  for (uint32_t i = 0; i < js_args->Length(); ++i) {
    Local<Value> js_arg = js_args->Get(i);
    if (!js_arg->IsString()) {
      Nan::ThrowTypeError("Arguments must be an array of strings");
      return;
    }

    args.push_back(std::string(*String::Utf8Value(js_arg)));
  }

  bool test_mode = false;
  if (info[2]->IsTrue()) test_mode = true;

  if (!info[3]->IsFunction()) {
    Nan::ThrowTypeError("Callback must be a function");
    return;
  }

  void *child_process = StartChildProcess(command, args, test_mode);
  if (!child_process) return;

  Nan::AsyncQueueWorker(new Worker(new Nan::Callback(info[3].As<Function>()), child_process, test_mode));
}

void Init(Handle<Object> exports) {
  Nan::SetMethod(exports, "getAuthorizationForm", GetAuthorizationForm);
  Nan::SetMethod(exports, "spawnAsAdmin", SpawnAsAdmin);
}

NODE_MODULE(fs_admin, Init)

}  // namespace spawn_as_admin
