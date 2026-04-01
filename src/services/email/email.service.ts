import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export interface EmailData {
  to: string;
  from: string;
  subject: string;
  html: string;
}

export async function sendEmail(data: EmailData): Promise<boolean> {
  try {
    const result = await resend.emails.send({
      from: data.from,
      to: data.to,
      subject: data.subject,
      html: data.html,
    });

    console.log('Email sent successfully:', result);
    return true;
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
}

export function generateRestockEmailContent(
  itemName: string,
  currentStock: number,
  minQuantity: number,
  customMessage?: string
): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #d32f2f;">Restock Alert</h2>
      <p>Dear Team,</p>
      <p>The following item requires restocking:</p>
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #1976d2;">${itemName}</h3>
        <p><strong>Current Stock:</strong> ${currentStock}</p>
        <p><strong>Minimum Quantity:</strong> ${minQuantity}</p>
        <p style="color: #d32f2f;"><strong>Status:</strong> Below minimum threshold</p>
      </div>
      ${customMessage ? `<p><strong>Message:</strong> ${customMessage}</p>` : ''}
      <p>Please take immediate action to restock this item.</p>
      <p>Best regards,<br>Restock Automation System</p>
    </div>
  `;
}