/**
 * Smart formatter for time ranges.
 * Input example: "8 - 5" -> "08:00 - 17:00"
 * Input example: "21:30 - 6" -> "21:30 - 06:00"
 */
export const formatTimeRange = (input: string): string => {
  if (!input || !input.includes('-')) return input;

  const parts = input.split('-').map(p => p.trim());
  if (parts.length !== 2) return input;

  const formatTime = (time: string, isEnd: boolean, startTimeHour?: number): string => {
    // Handle cases like "08:00", "8:30", "8"
    let [hours, minutes] = time.split(':').map(p => p?.trim());
    
    if (!hours) return time;
    
    let h = parseInt(hours, 10);
    let m = minutes ? parseInt(minutes, 10) : 0;

    if (isNaN(h)) return time;

    // Smart inference for AM/PM if only single digit or small number
    // If it's an end time and it's smaller than start time (e.g. 8 - 5), assume PM for end
    if (isEnd && startTimeHour !== undefined) {
      if (h < startTimeHour && h <= 12) {
        h += 12;
      }
    } else {
      // For start time or general: if 1-6 assume PM unless specified, but for shifts 7-11 usually AM
      // This is a heuristic. Let's keep it simple: 
      // If user types "8", "08:00". If "17", "17:00".
      // If "5" as end time and start was "8", make it 17.
    }

    const hh = String(h).padStart(2, '0');
    const mm = String(m).padStart(2, '0');
    return `${hh}:${mm}`;
  };

  const startRaw = parts[0];
  const endRaw = parts[1];

  const startTimeStr = formatTime(startRaw, false);
  const startHour = parseInt(startTimeStr.split(':')[0], 10);
  const endTimeStr = formatTime(endRaw, true, startHour);

  return `${startTimeStr} - ${endTimeStr}`;
};
