/**
 * Simple password hashing utility.
 * Uses btoa for basic obfuscation + a salt pattern.
 * NOT suitable for production. For demo/localStorage only.
 */

const PASSWORD_SALT = "swbpt_2026_"; // Simple salt prefix

/**
 * Hash a plain password using btoa + salt
 * @param {string} plainPassword - Plain text password
 * @returns {string} Hashed password
 */
export const hashPassword = (plainPassword) => {
  if (!plainPassword || typeof plainPassword !== "string") {
    return "";
  }
  return btoa(PASSWORD_SALT + plainPassword);
};

/**
 * Verify a plain password against a stored hash
 * @param {string} plainPassword - Plain text password to verify
 * @param {string} storedHash - Hashed password from storage
 * @returns {boolean} True if passwords match
 */
export const verifyPassword = (plainPassword, storedHash) => {
  if (!plainPassword || !storedHash) return false;
  const hash = hashPassword(plainPassword);
  return hash === storedHash;
};

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {object} { isValid: boolean, errors: string[] }
 */
export const validatePasswordStrength = (password) => {
  const errors = [];

  if (!password || password.length === 0) {
    errors.push("Password is required.");
  } else if (password.length < 6) {
    errors.push("Password must be at least 6 characters.");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};
