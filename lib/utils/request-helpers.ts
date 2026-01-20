/**
 * Calculate minutes from a time range
 * @param timeFrom - Time string in format "HH:MM" or "HH:mm"
 * @param timeTo - Time string in format "HH:MM" or "HH:mm"
 * @returns Number of minutes between the two times, or null if invalid
 */
export function calculateMinutesFromTimeRange(
  timeFrom: string | null | undefined,
  timeTo: string | null | undefined
): number | null {
  if (!timeFrom || !timeTo) {
    return null
  }

  try {
    // Parse time strings (format: "HH:MM" or "HH:mm")
    const [fromHours, fromMinutes] = timeFrom.split(':').map(Number)
    const [toHours, toMinutes] = timeTo.split(':').map(Number)

    if (
      isNaN(fromHours) ||
      isNaN(fromMinutes) ||
      isNaN(toHours) ||
      isNaN(toMinutes)
    ) {
      return null
    }

    const fromTotalMinutes = fromHours * 60 + fromMinutes
    const toTotalMinutes = toHours * 60 + toMinutes

    // Handle case where time_to is next day (e.g., 23:00 to 01:00)
    let diffMinutes = toTotalMinutes - fromTotalMinutes
    if (diffMinutes < 0) {
      diffMinutes += 24 * 60 // Add 24 hours
    }

    return diffMinutes
  } catch (error) {
    console.error('Error calculating minutes from time range:', error)
    return null
  }
}

/**
 * Determine adjustment type based on request type
 * @param requestType - The type of request (e.g., "PTO", "TIME_CORRECTION", etc.)
 * @returns Adjustment type, defaults to ADD_TIME
 */
export function getAdjustmentTypeFromRequestType(
  requestType: string
): 'ADD_TIME' | 'SUBTRACT_TIME' | 'OVERRIDE' {
  const upperType = requestType.toUpperCase()

  // Time correction requests typically add time
  if (upperType.includes('CORRECTION') || upperType.includes('CORRECT')) {
    return 'ADD_TIME'
  }

  // PTO and leave requests typically add time (paid time off)
  if (
    upperType.includes('PTO') ||
    upperType.includes('LEAVE') ||
    upperType.includes('VACATION')
  ) {
    return 'ADD_TIME'
  }

  // Medical leave, sick leave also add time
  if (upperType.includes('MEDICAL') || upperType.includes('SICK')) {
    return 'ADD_TIME'
  }

  // Default to ADD_TIME for most request types
  return 'ADD_TIME'
}

/**
 * Get effective date from requested_data
 * @param requestedData - The requested_data object from the request
 * @returns Date string in YYYY-MM-DD format, or null
 */
export function getEffectiveDateFromRequestData(
  requestedData: any
): string | null {
  if (!requestedData || typeof requestedData !== 'object') {
    return null
  }

  // Prefer date_from, fallback to date
  const dateStr = requestedData.date_from || requestedData.date

  if (!dateStr) {
    return null
  }

  // Validate date format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (dateRegex.test(dateStr)) {
    return dateStr
  }

  // Try to parse and format
  try {
    const date = new Date(dateStr)
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0]
    }
  } catch (error) {
    console.error('Error parsing date:', error)
  }

  return null
}
