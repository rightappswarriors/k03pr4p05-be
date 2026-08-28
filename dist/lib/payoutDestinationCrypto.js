import crypto from 'crypto';
const key = () => {
    const value = process.env.PAYOUT_DESTINATION_ENCRYPTION_KEY;
    if (!value)
        throw new Error('Payout destination encryption is not configured.');
    const decoded = Buffer.from(value, 'base64');
    if (decoded.length !== 32)
        throw new Error('Payout destination encryption key is invalid.');
    return decoded;
};
export const encryptPayoutDestination = (destination) => {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
    const ciphertext = Buffer.concat([cipher.update(destination, 'utf8'), cipher.final()]);
    return `v1:${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${ciphertext.toString('base64')}`;
};
/** Payout execution services only; never expose this value through an API. */
export const decryptPayoutDestination = (payload) => {
    const [version, iv, tag, ciphertext] = payload.split(':');
    if (version !== 'v1' || !iv || !tag || !ciphertext)
        throw new Error('Invalid encrypted payout destination.');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64')), decipher.final()]).toString('utf8');
};
