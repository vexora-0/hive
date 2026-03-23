import * as Crypto from 'expo-crypto';

export async function sha256(data: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, data);
}

export async function sha256File(uri: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();
  // blob.arrayBuffer() is unavailable in Hermes — use FileReader instead
  const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return sha256(binary);
}
