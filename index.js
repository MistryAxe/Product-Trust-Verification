import { registerRootComponent } from 'expo';
import React from 'react';
import { StartupProblem, installFatalErrorScreen, wrapWithFatalScreen } from './src/startup/StartupProblem';

// The app's own code is loaded INSIDE a try, so a failure while it loads shows its reason on screen
// instead of silently closing the app (see src/startup/StartupProblem.js).
installFatalErrorScreen();

let Root;
try {
  Root = require('./App').default;
} catch (error) {
  Root = function StartupFailure() {
    return <StartupProblem error={error} when="while the app was starting" />;
  };
}

registerRootComponent(wrapWithFatalScreen(Root));
