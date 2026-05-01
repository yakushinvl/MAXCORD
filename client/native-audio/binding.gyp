{
  "targets": [
    {
      "target_name": "maxcord_audio",
      "sources": [ "main.cpp" ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "cflags_cc": [ "-std=c++20" ],
      "defines": [ "NAPI_CPP_EXCEPTIONS", "WIN32_LEAN_AND_MEAN" ],
      "msvs_settings": {
        "VCCLCompilerTool": {
            "ExceptionHandling": 1,
            "AdditionalOptions": ["/std:c++20"]
        }
      },
      "conditions": [
        ['OS=="win"', {
          "libraries": [ 
              "-lmmdevapi.lib", 
              "-lole32.lib",
              "-lavrt.lib"
          ]
        }]
      ]
    }
  ]
}
