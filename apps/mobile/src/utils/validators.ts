export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

export function isValidOTP(otp: string, length = 6): boolean {
  return new RegExp(`^\\d{${length}}$`).test(otp);
}

export function sanitizeInput(input: string): string {
  return input.trim().replace(/[<>]/g, '');
}
