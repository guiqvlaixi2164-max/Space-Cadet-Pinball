// strings.js - all user-facing text in one place to ease future localization.
// No long-dash characters anywhere (project constraint): use a hyphen.

(function (PB) {
  'use strict';

  PB.strings = {
    title: 'SPACE CADET',
    subtitle: 'Deluxe Edition',

    // Attract / title.
    highScores: 'HIGH SCORES',
    noScores: 'No scores yet. Be the first.',
    pressStart: 'Press ENTER to launch your career',
    settingsHint: 'ESC: settings',

    // Pause menu.
    paused: 'PAUSED',
    resume: 'Resume',
    settings: 'Settings',
    quitToTitle: 'Quit to title',
    pauseFooter: 'ESC or P to resume',

    // Settings menu.
    settingsTitle: 'SETTINGS',
    volume: 'Volume',
    mute: 'Mute',
    reducedMotion: 'Reduced motion',
    colorblind: 'Colorblind palette',
    rebindLeft: 'Left flipper',
    rebindRight: 'Right flipper',
    rebindPlunger: 'Plunger',
    rebindNudgeLeft: 'Nudge left',
    rebindNudgeRight: 'Nudge right',
    rebindNudgeUp: 'Nudge up',
    rebindPause: 'Pause',
    back: 'Back',
    on: 'On',
    off: 'Off',
    settingsFooter: 'Up/Down select, Left/Right change, ENTER rebind, ESC back',
    pressAKey: 'press a key...',

    // Game over.
    gameOver: 'GAME OVER',
    newHighScore: 'NEW HIGH SCORE',
    enterInitials: 'Enter your initials',
    initialsHint: 'Up/Down letter, Left/Right move, ENTER confirm',
    continuePrompt: 'Press ENTER to continue',

    // In play.
    promoted: 'PROMOTED: ',
    ballSaved: 'BALL SAVED',
    jackpot: 'JACKPOT',
    bankCleared: 'BANK CLEARED',
    ballLabel: 'BALL ',
    launchHint: 'Hold SPACE to launch',

    // First-run onboarding (controls strip + reminders).
    controlsHint: 'SHIFT Flippers     SPACE Launch     ARROWS Nudge     P Pause',
    remapHint: 'Keys are rebindable in ESC settings',

    // Mission objective instructions (shown briefly when a mission starts).
    instrBumpers: 'Hit the pop bumpers!',
    instrBank: 'Clear the drop-target bank!',
    instrRescue: 'Hit the lit RESCUE target!',

    // Innovation callouts.
    dilationReady: 'SLO-MO READY  -  roll the ball through the zone',
    orbitLabel: 'ORBIT',
    asteroidBonus: 'BUMPERS 2X',

    // Missions and multiball.
    mWarp: 'WARP SURVEY',
    mTarget: 'TARGET LOCK',
    mRescue: 'RESCUE',
    mSelected: ' SELECTED',
    mStart: ' START',
    mJackpot: 'JACKPOT  +',
    mFailed: 'MISSION FAILED',
    mLocked: 'BALL LOCKED ',
    mMultiball: 'MULTIBALL!',
    mHitStart: 'HIT START',
    mLockLabel: 'LOCK ',
    mMultiballOn: 'MULTIBALL',

    // Innovations HUD.
    dilationLabel: 'SLO-MO',
    tableStation: 'STATION',
    tableAsteroid: 'ASTEROID FIELD',
  };

})(window.PB = window.PB || {});
