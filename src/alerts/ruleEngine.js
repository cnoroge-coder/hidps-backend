export function evaluateLog(log) {
  switch (log.type) {
    case 'login':
      if (
        typeof log.message === 'string' &&
        log.message.toLowerCase().includes('failed')
      ) {
        return {
          title: 'Failed Login Attempt',
          message: log.message,
          severity: 2,
          alert_type: 'login'
        };
      }
      break;

    case 'firewall':
      return {
        title: 'Firewall Activity Detected',
        message: log.message,
        severity: 3,
        alert_type: 'firewall'
      };

    case 'file_monitoring':
      return {
        title: 'File Modification Detected',
        message: log.message,
        severity: 3,
        alert_type: 'file'
      };

    case 'process':
      if (
        typeof log.message === 'string' &&
        log.message.includes('New process started')
      ) {
        return {
          title: 'New Process Started',
          message: log.message,
          severity: 1,
          alert_type: 'process'
        };
      }
      break;

    case 'system_usage':
      if (log.message.cpu_usage > 90) {
        return {
          title: 'High CPU Usage',
          message: JSON.stringify(log.message),
          severity: 2,
          alert_type: 'system'
        };
      }
      break;
  }

  return null;
}
