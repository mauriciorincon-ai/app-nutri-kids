import type { Dictionary } from "./es";

/**
 * EN dictionary — structural parity with es.ts enforced by the Dictionary type
 * (missing or extra keys fail typecheck) and by the runtime parity test.
 */
export const en: Dictionary = {
  app: {
    name: "Nutri-Kids",
    tagline: "Your kid's diet, alive and at hand",
  },
  nav: {
    today: "Today",
    diet: "Diet",
    supplements: "Supplements",
    load: "Load",
    settings: "Settings",
  },
  disclaimer: {
    short: "This guide does not replace your pediatrician.",
    full: "Nutri-Kids organizes the eating plan the family chose to follow. It is not a diagnosis or medical treatment: whenever in doubt, always check with your pediatrician or nutritionist.",
    firstUseTitle: "Before you start",
    firstUseBody:
      "This app turns your kid's nutrition plan into an easy-to-check guide. It is a daily helper, not medical advice: your pediatrician and nutritionist always have the last word.",
    firstUseAccept: "Got it, let's start",
  },
  source: {
    demo: "Demo diet",
    real: "Your diet",
    demoHint: "You are viewing the sample diet. Load yours in “Load”.",
    realHint: "You are viewing the diet loaded on this device.",
  },
  status: {
    green: "OK",
    yellow: "Limited",
    red: "Avoid",
    restrictedUntil: "until {date}",
    restrictionEnded:
      "the restriction is over — ask the professional how to reintroduce it",
    daysLeft: "{days} days left",
    lastDay: "last day",
    notFound:
      "That food is not in the plan. When in doubt, ask the professional.",
  },
  today: {
    title: "Today",
    summaryDone: "You've done {done} of {total}",
    summaryAllDone: "Day complete! You did everything for today",
    summaryEmpty: "This is today's plan — check each item as it happens",
    pendingLabel: "Still to go:",
    meals: "Meals",
    supplementCard: "Today's supplement",
    noSupplementToday: "No supplement today",
    noSupplementHint: "Rest easy: there is none on the calendar today.",
    water: "Glasses of water",
    waterGlass: "Glass {n}",
    markDone: "Mark {item} as done",
    markUndone: "Unmark {item}",
  },
  diet: {
    title: "The diet",
    searchPlaceholder: "Can they have…? Search a food",
    searchNoResults:
      "We couldn't find “{query}” in the plan. When in doubt, ask the professional.",
    tabGreen: "Green",
    tabYellow: "Yellow",
    tabRed: "Red",
    restrictedSection: "Restricted for now",
    restrictedIntro:
      "These foods are taking a break. It's not an allergy: they have a return date.",
    additivesSection: "Additives to avoid (labels)",
    additivesIntro:
      "When buying anything packaged, check the label does NOT list these codes:",
    additiveFoundIn: "Usually found in: {where}",
    alsoAvoid: "Also avoid",
    groupPortion: "Portion: {portion}",
    seeDetail: "See details for {name}",
  },
  detail: {
    whyTitle: "Why?",
    limitTitle: "How much?",
    equivalencesTitle: "If it's missing, use…",
    restrictedNote: "Restricted {until}",
    backToDiet: "Back to the diet",
  },
  supplements: {
    title: "This week's supplements",
    intro: "Each supplement has its days. Check today's once it's been taken.",
    todayLabel: "today",
    dose: "Dose: {dose}",
    when: "{when}",
    taken: "Taken",
    markTaken: "Mark {name} as taken today",
    noneThatDay: "None",
    notesTitle: "Good to know",
  },
  weekdays: {
    mon: "Monday",
    tue: "Tuesday",
    wed: "Wednesday",
    thu: "Thursday",
    fri: "Friday",
    sat: "Saturday",
    sun: "Sunday",
  },
  load: {
    title: "Load your diet",
    emptyTitle: "No diet loaded yet",
    emptyBody:
      "Ask whoever has it for the diet file (it ends in .json) and open it here. Meanwhile you can explore the app with the demo diet.",
    pickFile: "Choose file",
    orPaste: "…or paste the content",
    pasteHint:
      "If the file won't open on the phone, copy all its content and paste it here:",
    pastePlaceholder: "Paste the diet file content here",
    importPasted: "Load pasted content",
    validating: "Checking the file…",
    successTitle: "Diet loaded!",
    successBody: "Here is what we found in your diet:",
    countGroups: "{n} allowed food groups",
    countRestricted: "{n} foods on a temporary break",
    countAdditives: "{n} additives to watch on labels",
    countSupplements: "{n} supplements with their calendar",
    countMeals: "{n} meal moments per day",
    goToday: "Go to Today",
    errorInvalidJson:
      "That file could not be read as a diet. Check it is the right .json file and try again.",
    errorInvalidSchema:
      "The file opens, but it doesn't have the Nutri-Kids diet format. Ask again for the original .json file from whoever shared it.",
    errorNoStorage:
      "Your browser didn't allow saving the diet on the device. Try another browser (for example Chrome).",
    activeSource: "Active diet:",
    useDemo: "Use the demo",
    useReal: "Use your diet",
  },
  settings: {
    title: "Settings",
    language: "Language",
    languageEs: "Español",
    languageEn: "English",
    dietVersion: "Loaded diet",
    dietVersionDemo: "Sample demo (no diet loaded)",
    dietVersionInfo: "{title} · issued on {date}",
    clearTitle: "Delete data",
    clearBody:
      "Deletes the loaded diet and the day's checkmarks from this device. The app returns to the demo.",
    clearButton: "Delete my data",
    clearConfirmTitle: "Delete everything?",
    clearConfirmBody:
      "The loaded diet and the checkmark history will be deleted. This cannot be undone.",
    clearConfirmYes: "Yes, delete",
    clearConfirmNo: "Cancel",
    clearedToast: "Data deleted. You're back on the demo diet.",
    disclaimerTitle: "About this app",
  },
  a11y: {
    mainNav: "Main navigation",
    statusIcon: "Status: {status}",
    loading: "Loading…",
  },
};
