require('dotenv').config();

async function sendEmail(to, subject, text) {
  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY || 'sF0jECvhIqT8pYx6',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: { email: process.env.EMAIL_FROM },
        to: [{ email: to }],
        subject,
        htmlContent: text,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`Email sent to ${to}: ${data.messageId || 'Success'}`);
    } else {
      const error = await response.text();
      console.error(`Error sending email to ${to}: ${response.status} ${error}`);
    }
  } catch (error) {
    console.error(`Error sending email to ${to}:`, error);
  }
}

module.exports = { sendEmail };
