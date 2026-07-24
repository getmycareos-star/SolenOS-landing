import type { TimeOfDay } from "./contract-constants";

/** Hour ranges use local wall-clock hour [0, 23]. */
export function classifyTimeOfDay(date: Date = new Date()): TimeOfDay {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "night";
  return "late_night";
}

export function isLateNight(timeOfDay: TimeOfDay): boolean {
  return timeOfDay === "late_night";
}

export function isMorning(timeOfDay: TimeOfDay): boolean {
  return timeOfDay === "morning";
}

export function isHighActivityWindow(timeOfDay: TimeOfDay): boolean {
  return timeOfDay === "afternoon";
}
