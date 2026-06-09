class Logger {
  static log(message, icon = 'ℹ️ ') {
    if (process.env.LOG_LEVEL !== 'silent') {
      console.log(`${icon} ${message}`);
    }
  }

  static step(message) {
    const verbose =
      process.env.LOG_LEVEL === 'debug' ||
      ['1', 'true', 'yes'].includes(String(process.env.HEADED || '').toLowerCase());
    if (verbose) {
      this.log(message, '🔹');
    }
  }

  static success(message) {
    this.log(message, '✅');
  }

  static error(message) {
    this.log(message, '❌');
  }

  static info(message) {
    this.log(message, 'ℹ️ ');
  }
}

function generateRandomProjectName(prefix = 'Automation_Test_Project') {
  const randomString = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}_${randomString}`;
}


module.exports = { Logger };
