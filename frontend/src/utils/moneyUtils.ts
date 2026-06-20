/**
 * Utility functions to handle financial mathematics safely in JavaScript.
 * Resolves floating point rounding errors (e.g. 0.1 + 0.2 = 0.30000000000000004).
 */

export const moneyUtils = {
  /**
   * Converts a float value into integer cents safely.
   */
  toCents(amount: number): number {
    return Math.round(amount * 100);
  },

  /**
   * Converts integer cents back to float.
   */
  fromCents(cents: number): number {
    return cents / 100;
  },

  /**
   * Safely adds multiple currency amounts.
   */
  add(...amounts: number[]): number {
    const totalCents = amounts.reduce((sum, amt) => sum + this.toCents(amt), 0);
    return this.fromCents(totalCents);
  },

  /**
   * Safely subtracts the second amount from the first.
   */
  subtract(base: number, amountToSubtract: number): number {
    return this.fromCents(this.toCents(base) - this.toCents(amountToSubtract));
  },

  /**
   * Safely multiplies a currency amount by a scalar (e.g., tax rate) and rounds to 2 decimal places.
   */
  multiply(amount: number, multiplier: number): number {
    const rawResult = amount * multiplier;
    return this.fromCents(Math.round(rawResult * 100));
  },

  /**
   * Formats an amount as a currency string.
   */
  format(amount: number, currencyCode: string = 'USD'): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
    }).format(amount);
  }
};
