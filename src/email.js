require('dotenv').config();

async function sendEmail(to, subject, htmlContent, textContent = '') {
  if (!process.env.BREVO_API_KEY) {
    throw new Error('BREVO_API_KEY is missing in environment variables');
  }
  if (!process.env.EMAIL_FROM) {
    throw new Error('EMAIL_FROM is missing in environment variables');
  }

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        sender: { 
          email: process.env.EMAIL_FROM,
          name: 'HIDPS Security Alerts'  // Optional but recommended
        },
        to: [{ email: to }],
        subject,
        htmlContent,
        textContent: textContent || htmlContent.replace(/<[^>]+>/g, ''), // fallback
      }),
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`Email sent to ${to} → Message ID: ${data.messageId || 'Success'}`);
      return { success: true, messageId: data.messageId };
    } else {
      const errorData = await response.json().catch(() => ({}));
      console.error(`Brevo error ${response.status}:`, errorData.message || await response.text());
      return { success: false, error: errorData.message || 'Unknown error' };
    }
  } catch (error) {
    console.error(`Network/Unexpected error sending email to ${to}:`, error);
    return { success: false, error: error.message };
  }
}

module.exports = { sendEmail };
