// The lab's help switches (a task's `help`, lab/Setup.js normalizeHelp), as the task forms show them.
// `trouble`: only for troubleshooting tasks.
export const HELP_OPTIONS = [
  {
    key: "steps",
    title: "Step-by-step guide",
    on: "The task card lists the steps to follow.",
    off: "Hidden: students work out the order themselves.",
  },
  {
    key: "labels",
    title: "Labels on the board",
    on: "Header names show on the board (PWR, CPU_FAN, U32G1...).",
    off: "Hidden: students find each header by its shape and place.",
  },
  {
    key: "ramNumbers",
    title: "RAM slot numbers",
    on: "The slots show 1 to 4 while a stick is placed.",
    off: "Hidden: students count the slots themselves.",
  },
  {
    key: "faultsLeft",
    title: "Faults left",
    on: "Students see how many faults they've fixed, and their score as they go.",
    off: "Hidden until the PC is fixed: students check everything.",
    trouble: true,
  },
];
