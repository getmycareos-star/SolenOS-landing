import fs from "node:fs";
import assert from "node:assert/strict";

const settings = fs.readFileSync("src/app/workspace/settings/page.tsx", "utf8");
const notificationLoad = settings.slice(
  settings.indexOf("const loadPreferences = useCallback"),
  settings.indexOf("useEffect(() => { void loadPreferences();"),
);
const notificationPersist = settings.slice(
  settings.indexOf("const persist = async"),
  settings.indexOf("return (", settings.indexOf("const persist = async")),
);
const caregiverCardStart = settings.indexOf("function CaregiverPreferencesCard()");
const caregiverCard = settings.slice(caregiverCardStart);

assert.match(caregiverCard, /getJSON\(["']\/caregiver\/preferences["']\)/, "caregiver preferences must hydrate from the authenticated backend profile");
assert.match(caregiverCard, /patchJSON\(["']\/caregiver\/preferences["']/, "caregiver preferences must persist through the authenticated backend profile");
assert.match(caregiverCard, /preferred_name:[\s\S]*timezone:[\s\S]*date_format:[\s\S]*measurement_system:[\s\S]*communication_style:/, "caregiver-specific preferences must be sent as one profile update");
assert.doesNotMatch(notificationLoad, /\/caregiver\/preferences/, "notification settings must not load Companion timezone as their default");
assert.doesNotMatch(notificationPersist, /\/caregiver\/preferences/, "saving quiet hours must not read or mutate Companion preferences");
assert.match(notificationLoad, /prefs\.configured[\s\S]*prefs\.timezone_name/, "notification timezone must hydrate from notification preferences");
assert.match(notificationPersist, /timezone_name: timezoneName/, "quiet-hours writes must use the independently selected notification timezone");
assert.match(settings, /Quiet-hours time zone/, "notification timezone must be independently editable");
assert.match(settings, /This time zone controls quiet hours only/, "the interface must explain the separation from Companion timezone");

console.log("PASS: Companion caregiver preferences and notification delivery timezone remain separate.");
