import { PaymentMethod } from '../types/transaction';

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export interface TransactionFormValues {
  customerName: string;
  barberId: string;
  serviceId: string;
  amount: string;
  paymentMethod: PaymentMethod | '';
  gcashReference: string;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function parseAmount(text: string): number {
  const value = Number(String(text).replace(/[₱,\s]/g, ''));
  return Number.isFinite(value) ? value : NaN;
}

export function validateLogin(email: string, password: string): ValidationResult {
  const errors: Record<string, string> = {};
  if (!email.trim()) errors.email = 'Please enter your email.';
  else if (!isValidEmail(email)) errors.email = 'That email address does not look right.';
  if (!password) errors.password = 'Please enter your password.';
  else if (password.length < 6) errors.password = 'Password must be at least 6 characters.';
  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateTransaction(values: TransactionFormValues): ValidationResult {
  const errors: Record<string, string> = {};
  if (!values.customerName.trim()) errors.customerName = 'Customer name is required.';
  if (!values.barberId) errors.barberId = 'Please select a barber.';
  if (!values.serviceId) errors.serviceId = 'Please select a service.';

  const amount = parseAmount(values.amount);
  if (!values.amount.trim()) errors.amount = 'Amount is required.';
  else if (Number.isNaN(amount)) errors.amount = 'Amount must be a number.';
  else if (amount <= 0) errors.amount = 'Amount must be greater than 0.';

  if (!values.paymentMethod) errors.paymentMethod = 'Choose Cash or GCash.';
  if (values.paymentMethod === 'GCASH') {
    const reference = values.gcashReference.trim();
    if (!reference) errors.gcashReference = 'GCash reference number is required.';
    else if (!/^[A-Za-z0-9-]{6,20}$/.test(reference))
      errors.gcashReference = 'Reference must be 6–20 letters or numbers.';
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateService(
  name: string,
  price: string,
  duration: string,
  minimumPrice: number
): ValidationResult {
  const errors: Record<string, string> = {};
  if (!name.trim()) errors.name = 'Service name is required.';
  const priceValue = parseAmount(price);
  if (Number.isNaN(priceValue) || priceValue <= 0) errors.price = 'Enter a valid price.';
  else if (priceValue < minimumPrice)
    errors.price = `Price is below the configured minimum of ₱${minimumPrice}.`;
  const durationValue = Number(duration);
  if (!Number.isFinite(durationValue) || durationValue <= 0)
    errors.duration = 'Enter the average duration in minutes.';
  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateExpense(name: string, amount: string): ValidationResult {
  const errors: Record<string, string> = {};
  if (!name.trim()) errors.name = 'Expense name is required.';
  const value = parseAmount(amount);
  if (Number.isNaN(value) || value <= 0) errors.amount = 'Enter a valid amount.';
  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateQueueEntry(customerName: string, serviceId: string): ValidationResult {
  const errors: Record<string, string> = {};
  if (!customerName.trim()) errors.customerName = 'Customer name is required.';
  if (!serviceId) errors.serviceId = 'Please select a service.';
  return { valid: Object.keys(errors).length === 0, errors };
}

export function validatePasswordChange(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string
): ValidationResult {
  const errors: Record<string, string> = {};
  if (!currentPassword) errors.currentPassword = 'Enter your current password.';
  if (!newPassword) errors.newPassword = 'Enter a new password.';
  else if (newPassword.length < 6) errors.newPassword = 'New password must be at least 6 characters.';
  else if (newPassword === currentPassword)
    errors.newPassword = 'The new password must be different from the current one.';
  if (!confirmPassword) errors.confirmPassword = 'Please re-type the new password.';
  else if (confirmPassword !== newPassword) errors.confirmPassword = 'The passwords do not match.';
  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateResetRequest(email: string): ValidationResult {
  const errors: Record<string, string> = {};
  if (!email.trim()) errors.email = 'Enter the email address of your account.';
  else if (!isValidEmail(email)) errors.email = 'That email address does not look right.';
  return { valid: Object.keys(errors).length === 0, errors };
}
