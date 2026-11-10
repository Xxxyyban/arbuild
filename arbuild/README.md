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
    npm test          # the lab's rules, score and how often it saves

Firebase (Auth, Firestore, Storage) is configured in `src/firebase/config.js`. Security rules are
in `firestore.rules` and `storage.rules`; publish them in the Firebase console. The attack tests
for the rules are in `tests/firestore-rules/` (see its README).

## Running on Firebase's free plan

ARBuild is built to stay on the free (Spark) plan. Three things follow from that:

- **Class posts carry links, not files.** File storage needs the paid plan, so the Attach file
  button is off (`FILES_ON` in `src/firebase/config.js`). Instructors share a link instead: Google
  Drive (shared as "Anyone with the link"), YouTube, Slides.
- **The database has daily limits for the whole school: 50,000 reads and 20,000 writes.** When one
  runs out, nothing loads or saves until it resets (about 4 PM in the Philippines). To stay inside
  them, a lab saves each student's progress at most every 30 seconds (`src/lab/rowSaver.js`), its
  log keeps mistakes but not every correct step, and one set of class listeners serves every page
  (`src/components/class/FeedLayout.jsx`). Real use shows in the Firebase console: Firestore
  Database, then Usage.
- **Scores are worked out and saved by the student's own browser**, because checking them on a
  server needs the paid plan. A lab score is a practice result that the hands-on assessment
  confirms, not proof on its own.
