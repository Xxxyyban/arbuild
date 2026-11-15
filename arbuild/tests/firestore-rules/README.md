# Firestore rules attack tests

Tries to break into the database the way an attacker would (read other people's data, fake grades,
impersonate students or the instructor, take over classes) and checks every attempt is refused.
It also replays the app's own writes, so a rules change that would break the app fails here too.

It runs on Firebase's local emulator: your real database is never touched.

Needs Java 21+ (today's Firebase CLI won't start the emulator on older Java) and the Firebase CLI
(`npm i -g firebase-tools`). Java doesn't have to be installed system-wide: set `JAVA_HOME` and put its
`bin` folder first on `PATH` for the session.

    cd tests/firestore-rules
    npm install
    npm test

Run it after every change to `firestore.rules`, before publishing the rules.
