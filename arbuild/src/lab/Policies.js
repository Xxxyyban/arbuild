// The Data Privacy Notice and the Terms of Use that people agree to when they set up their account
// (pages/ProfileSetup.jsx), and can read again from About and their profile (components/PolicyDialog.jsx).
// Their agreement is kept on their profile: consent = { privacy, terms, at } (the versions they agreed
// to, and when, by the server's clock). Changing what either says: change POLICY_VERSION too.
// Only what ARBuild really keeps and does goes here; keep it short.

export const POLICY_VERSION = "2026-11-09";

export const PRIVACY = {
  title: "Data Privacy Notice",
  intro:
    "ARBuild is the virtual PC assembly lab of Universidad de Dagupan. This notice says what it keeps about you, why, and who sees it, as the Data Privacy Act of 2012 (Republic Act No. 10173) requires.",
  sections: [
    {
      heading: "What ARBuild keeps",
      items: [
        "Your account: your name, school email and role, and your student ID and section (students) or department (instructors), as the administrator sets them up.",
        "What you choose to add: a contact number and a profile picture.",
        "Your class work: the classes you join, your lab activity results (scores, times and mistakes), and the posts and comments you write.",
        "Your sign-ins: when you sign in, on what device and browser, and roughly where from (the city, region and country your internet connection shows, and your internet provider).",
      ],
    },
    {
      heading: "Why",
      items: [
        "To run your classes and lab activities, and to record and grade your lab work.",
        "To keep accounts safe, for example by spotting a sign-in from an unusual place.",
        "To keep a record of what happens in a class, such as a student being removed from it.",
      ],
    },
    {
      heading: "Who sees it",
      items: [
        "You see your own.",
        "Your instructors see your name, student ID, section, email, contact number, picture and results in the classes you join.",
        "ARBuild's administrators manage accounts and see sign-in records.",
        "It's stored on Google Firebase, the service ARBuild runs on. It isn't sold or shared with anyone else.",
      ],
    },
    {
      heading: "How long, and your rights",
      items: [
        "It's kept while your account is active, and after that for as long as the school keeps academic records.",
        "You can ask to see, correct or delete your data, or withdraw your consent, through the ARBuild administrator or the University's Data Protection Officer. Without your consent, you can't use ARBuild.",
      ],
    },
  ],
};

export const TERMS = {
  title: "Terms of Use",
  intro: "ARBuild is for learning. By using it, you agree to the following.",
  sections: [
    {
      heading: "Your account",
      items: [
        "Use only your own account, and keep your password to yourself.",
        "The administrator can deactivate an account that breaks these terms or the school's rules.",
      ],
    },
    {
      heading: "Your work and your classes",
      items: [
        "Do your own lab work. Don't try to change scores or anyone's data, or to get around ARBuild's security.",
        "Be respectful in class posts and comments.",
        "Your instructor records and grades your lab work in ARBuild, and can remove you from a class. Removals are recorded.",
      ],
    },
    {
      heading: "Real hardware",
      items: ["ARBuild teaches the steps. When you work on a real PC, follow your instructor and the lab's safety rules."],
    },
  ],
};

export const POLICIES = { privacy: PRIVACY, terms: TERMS };
