# ARBuild

A virtual PC assembly and troubleshooting lab for **Computer Systems Servicing NC II**, made for
Universidad de Dagupan (SITE).

Students learn what to do before they touch real hardware: pick compatible parts, build a PC in 3D
or augmented reality, wire it, power it on, and troubleshoot what goes wrong, then take it apart
safely. It's built for school, and students can keep practising at home or wherever they are.

It runs in the browser on **any phone, tablet or computer**, because not every student has a laptop.

ARBuild doesn't replace hands-on work. It helps students understand the steps first, virtually, so
they're ready for the actual manual assembly and troubleshooting in the lab.

## What's in it

- **Rig Studio**: explore a PC's parts in 3D and AR.
- **Build Lab**: assemble and disassemble AM4 and AM5 PCs, with real compatibility, cables, screws,
  boot problems and safety steps. Free build for practice; scored tasks in class.
- **Classes**: instructors make a class (subject, section, schedule) and share its code. Inside it:
  announcements, learning materials, lab activities with official scores, progress, and private
  messages between instructor and student.

## Development

    npm install
    npm run dev       # https://localhost:5173
    npm run build

Firebase (Auth, Firestore, Storage) is configured in `src/firebase/config.js`. Security rules are
in `firestore.rules` and `storage.rules`; publish them in the Firebase console. The attack tests
for the rules are in `tests/firestore-rules/` (see its README).
