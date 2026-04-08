// rai-pos-backend/src/services/email/supplier.email.ts

interface SupplierEmailOptions {
  items: { name: string; requestedQty: number }[];
  portalUrl: string;
  tempPassword: string;
  userMessage?: string;
  expectedArrival: Date;
  location?: {
    address: string;
    latitude: number;
    longitude: number;
  };
}

export function generateSupplierEmail(opts: SupplierEmailOptions): string {
  const itemRows = opts.items
    .map(
      (item) => `
      <tr>
        <td style="padding:10px 14px;border-bottom:1px solid #eee;">${item.name}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">
          ${item.requestedQty}
        </td>
      </tr>`
    )
    .join('');

  const arrivalDate = opts.expectedArrival.toLocaleDateString('en-PH', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  if (process.env.NODE_ENV === "development") {
    console.log('Generating email with expected arrival:', arrivalDate);
    console.log("URL: ", opts.portalUrl);
  }
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#222;">
      <div style="background:#1D9E75;padding:24px;border-radius:8px 8px 0 0;">
        <h2 style="color:#fff;margin:0;">New Restock Order</h2>
        <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;">Expected by ${arrivalDate}</p>
      </div>

      <div style="padding:24px;background:#fff;border:1px solid #eee;border-top:none;">
        ${opts.userMessage ? `<p style="background:#f5f5f5;padding:12px;border-radius:6px;margin-bottom:20px;">${opts.userMessage}</p>` : ''}

        <h3 style="margin:0 0 12px;">Items Requested</h3>
        <table style="width:100%;border-collapse:collapse;background:#fafafa;border-radius:6px;overflow:hidden;">
          <thead>
            <tr style="background:#f0f0f0;">
              <th style="padding:10px 14px;text-align:left;font-size:12px;color:#666;">Item</th>
              <th style="padding:10px 14px;text-align:right;font-size:12px;color:#666;">Qty Requested</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>

        ${opts.location ? `
        <div style="margin:28px 0;padding:20px;background:#f0f8ff;border-radius:8px;border:1px solid #b3d9ff;">
          <h3 style="margin:0 0 12px;color:#1976d2;">Delivery Location</h3>
          <p style="margin:0 0 12px;font-size:14px;"><strong>Address:</strong> ${opts.location.address}</p>
          <iframe
            src="https://www.google.com/maps?q=${opts.location.latitude},${opts.location.longitude}&z=15&output=embed"
            width="100%"
            height="200"
            style="border:0;border-radius:6px;"
            loading="lazy">
          </iframe>
        </div>
        ` : ''}

        <div style="margin:28px 0;padding:20px;background:#f9f6ff;border-radius:8px;border:1px solid #c9bff5;">
          <p style="margin:0 0 6px;font-size:13px;color:#666;">Your portal access credentials:</p>
          <p style="margin:0 0 4px;font-size:14px;">
            <strong>Password:</strong>
            <code style="background:#fff;padding:2px 8px;border-radius:4px;font-size:15px;letter-spacing:2px;">${opts.tempPassword}</code>
          </p>
        </div>

        <a href="${opts.portalUrl}"
           style="display:block;background:#1D9E75;color:#fff;text-decoration:none;
                  text-align:center;padding:14px;border-radius:8px;font-size:15px;
                  font-weight:700;letter-spacing:0.5px;">
          Open Order Portal
        </a>

        <p style="font-size:12px;color:#999;margin-top:16px;text-align:center;">
          This link expires in 7 days. Enter your password when prompted.
        </p>
      </div>
    </div>
  `;
}