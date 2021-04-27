{
  'target_defaults': {
    'win_delay_load_hook': 'false',
    'conditions': [
      ['OS=="win"', {
        'msvs_disabled_warnings': [
          4530,  # C++ exception handler used, but unwind semantics are not enabled
          4506,  # no definition for inline function
        ],
      }],
    ],
  },
  'targets': [
    {
      'target_name': 'fs_admin',
      'defines': [
        "NAPI_VERSION=<(napi_build_version)",
      ],
      'cflags!': [ '-fno-exceptions' ],
      'cflags_cc!': [ '-fno-exceptions' ],
      'xcode_settings': { 'GCC_ENABLE_CPP_EXCEPTIONS': 'YES',
        'CLANG_CXX_LIBRARY': 'libc++',
        'MACOSX_DEPLOYMENT_TARGET': '10.7',
      },
      'msvs_settings': {
        'VCCLCompilerTool': { 'ExceptionHandling': 1 },
      },
      'sources': [
        'src/main.cc',
      ],
      'include_dirs': [
        '<!(node -p "require(\'node-addon-api\').include_dir")',
      ],
      'conditions': [
        ['OS=="win"', {
          'sources': [
            'src/fs-admin-win.cc',
          ],
          'libraries': [
            '-lole32.lib',
            '-lshell32.lib',
          ],
        }],
        ['OS=="mac"', {
          'sources': [
            'src/fs-admin-darwin.cc',
          ],
          'libraries': [
            '$(SDKROOT)/System/Library/Frameworks/Security.framework',
          ],
        }],
        ['OS=="linux"', {
          'sources': [
            'src/fs-admin-linux.cc',
          ],
        }],
      ],
    }
  ]
}
