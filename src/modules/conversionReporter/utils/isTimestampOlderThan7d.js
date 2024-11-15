const SEVEN_DAYS_IN_SECONDS = 7 * 24 * 60 * 60; // 7 days * 24 hours * 60 minutes * 60 seconds

function isTimestampOlderThan7d(timestamp) {
    
    // Check if the timestamp is a number or a string that can be converted to a number
    if (typeof timestamp !== "number" && (typeof timestamp !== "string" || isNaN(timestamp))) {
      return false;
    }
  
    // Convert to a number if it's a string
    const numTimestamp = Number(timestamp);
  
    // Check if the number is an integer
    if (!Number.isInteger(numTimestamp)) {
      return false;
    }
  
    // Exclude timestamps that are older than 7 days
    const nowInSeconds = Math.floor(Date.now() / 1000);
    const secondsDiff = nowInSeconds - numTimestamp;
    if (secondsDiff >= SEVEN_DAYS_IN_SECONDS) {
      return false;
    }
  
    // Create a date object using the timestamp (multiplied by 1000 to convert to milliseconds)
    const date = new Date(numTimestamp * 1000);
  
    // Check if the date object represents a valid date
    return !isNaN(date.getTime());
}

module.exports = isTimestampOlderThan7d;