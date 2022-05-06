import CryptoJS from "crypto-js";

export function encrypt(text: string, secret?: string): string
{
   return CryptoJS.AES.encrypt(text, secret || process.env.ENCRYPT_SECRET).toString();
}

export function decrypt(text: string, secret?: string): string
{
   const bytes = CryptoJS.AES.decrypt(text, secret || process.env.ENCRYPT_SECRET);
   return bytes.toString(CryptoJS.enc.Utf8 as any);
}

export function encryptSHA256(text: string): string
{
   return CryptoJS.SHA256(text).toString();
}