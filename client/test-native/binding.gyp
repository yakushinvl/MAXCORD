{
  "targets": [{
    "target_name": "hello",
    "sources": ["hello.cc"],
    "include_dirs": [
      "<!@(node -p \"require('node-addon-api').include\")"
    ],
    "cflags_cc": [ "-std=c++20" ],
    "defines": [ "NAPI_CPP_EXCEPTIONS" ],
    "msvs_settings": {
        "VCCLCompilerTool": {
            "ExceptionHandling": 1,
            "AdditionalOptions": ["/std:c++20"]
        }
    }
  }]
}
