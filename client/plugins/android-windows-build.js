// Makes native Android builds work on Windows, where C++ build paths inside node_modules
// exceed the 260-character limit.
//  1. Stage CMake output in a short folder.
//  2. The CMake 3.22 that Android Studio installs ships Ninja 1.10, which cannot use long paths.
//     Point android/local.properties at a newer CMake (cmake.dir=C:/Program Files/CMake) and make
//     sure a Ninja 1.12+ is on PATH.
// Written into settings.gradle so it runs before each module reads the settings.
// It does nothing on macOS/Linux.
const { withSettingsGradle } = require("expo/config-plugins");

const MARKER = "// android-windows-build";
const SNIPPET = `
${MARKER}
if (System.getProperty("os.name").toLowerCase().contains("win")) {
  gradle.beforeProject { p ->
    ["com.android.library", "com.android.application"].each { id ->
      p.plugins.withId(id) {
        p.android.externalNativeBuild.cmake.buildStagingDirectory = new File("C:/cxx/" + p.name)
      }
    }
  }
}
`;

module.exports = (config) =>
  withSettingsGradle(config, (cfg) => {
    if (!cfg.modResults.contents.includes(MARKER)) cfg.modResults.contents += SNIPPET;
    return cfg;
  });
