import { sendEmail } from './email.service.js';
export async function sendPOStatusEmail(to, poNumber, status) {
    const isAccepted = status === 'ACCEPTED';
    await sendEmail({
        from: 'Kompra <no-reply@kompra.ph>',
        to,
        subject: `Purchase Order ${poNumber} ${isAccepted ? 'Accepted' : 'Rejected'}`,
        html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:${isAccepted ? '#22c55e' : '#ef4444'}">
          PO ${isAccepted ? 'Accepted ✓' : 'Rejected ✗'}
        </h2>
        <p>Your purchase order <strong>${poNumber}</strong> has been <strong>${isAccepted ? 'accepted' : 'rejected'}</strong> by the supplier.</p>
        ${isAccepted
            ? '<p>The supplier will deliver on the scheduled date. You will receive a confirmation email once the delivery is dispatched.</p>'
            : '<p>Please contact your supplier for more information or create a new purchase order.</p>'}
      </div>
    `,
    });
}
export async function sendDeliveryConfirmationEmail(to, poNumber) {
    await sendEmail({
        from: 'Kompra <no-reply@kompra.ph>',
        to,
        subject: `Delivery Confirmed — ${poNumber}`,
        html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#22c55e">Delivery Confirmed ✓</h2>
        <p>Your purchase order <strong>${poNumber}</strong> has been marked as <strong>delivered</strong>.</p>
        <p>If you have item mappings configured, your stock has been automatically updated. Otherwise, please receive the items manually in your POS.</p>
      </div>
    `,
    });
}
export async function sendNewPONotificationEmail(to, poNumber, buyerName, totalAmount) {
    const formattedAmount = new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP',
    }).format(totalAmount);
    await sendEmail({
        from: 'Kompra <no-reply@kompra.ph>',
        to,
        subject: `New Purchase Order — ${poNumber}`,
        html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#3b82f6">New Purchase Order 📋</h2>
        <p>You have received a new purchase order from <strong>${buyerName}</strong>.</p>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:8px;color:#6b7280;">PO Number</td>
            <td style="padding:8px;font-weight:600;">${poNumber}</td>
          </tr>
          <tr>
            <td style="padding:8px;color:#6b7280;">Total Amount</td>
            <td style="padding:8px;font-weight:600;">${formattedAmount}</td>
          </tr>
        </table>
        <p>Please log in to Kompra to review and accept or reject this order.</p>
      </div>
    `,
    });
}
