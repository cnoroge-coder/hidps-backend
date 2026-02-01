export function evaluate(event) {
  if (event.type === 'failed_login' && event.count >= 5) {
    return {
      title: 'Multiple Failed Logins',
      message: 'More than 5 failed login attempts detected',
      severity: 3,
      alert_type: 'login'
    };
  }

  if (event.type === 'sudo_command') {
    return {
      title: 'Sudo Command Executed',
      message: `Command: ${event.command}`,
      severity: 2,
      alert_type: 'login'
    };
  }

  return null;
}
