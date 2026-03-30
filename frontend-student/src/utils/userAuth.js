/**
 * User authentication and credentials management
 */

import { loadFromStorage, saveToStorage } from "./storage";
import { hashPassword, verifyPassword } from "./passwordUtils";

const USER_AUTH_KEY = "userAuth"; // Key for storing full auth data with password

/**
 * Initialize or get user auth record
 * @returns {object} User auth record { username, email, phone, passwordHash }
 */
export const initializeUserAuth = () => {
  let auth = loadFromStorage(USER_AUTH_KEY, null);

  if (!auth) {
    // Create default user if none exists
    auth = {
      username: "Student User",
      email: "student@example.com",
      phone: "",
      passwordHash: hashPassword("password123"), // Default: "password123"
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveToStorage(USER_AUTH_KEY, auth);
  }

  return auth;
};

/**
 * Get current user auth record
 * @returns {object} User auth record or null
 */
export const getUserAuth = () => {
  return loadFromStorage(USER_AUTH_KEY, null) || initializeUserAuth();
};

/**
 * Update user profile (username, email, phone only)
 * @param {object} updates - { username?, email?, phone? }
 * @returns {object} { success: boolean, error?: string, data?: object }
 */
export const updateUserProfile = (updates) => {
  try {
    const auth = getUserAuth();

    if (updates.username && typeof updates.username === "string") {
      auth.username = updates.username.trim();
    }
    if (updates.email && typeof updates.email === "string") {
      auth.email = updates.email.trim();
    }
    if (updates.phone !== undefined) {
      auth.phone = (updates.phone || "").trim();
    }

    auth.updatedAt = new Date().toISOString();

    const success = saveToStorage(USER_AUTH_KEY, auth);
    if (!success) {
      return { success: false, error: "Failed to save profile to storage" };
    }

    return { success: true, data: auth };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Change user password
 * @param {string} currentPassword - Current password (plain)
 * @param {string} newPassword - New password (plain)
 * @returns {object} { success: boolean, error?: string }
 */
export const changePassword = (currentPassword, newPassword) => {
  try {
    if (!currentPassword || typeof currentPassword !== "string") {
      return { success: false, error: "Current password is required." };
    }

    if (!newPassword || typeof newPassword !== "string") {
      return { success: false, error: "New password is required." };
    }

    const auth = getUserAuth();

    // Verify current password
    if (!verifyPassword(currentPassword, auth.passwordHash)) {
      return { success: false, error: "Current password is incorrect." };
    }

    // Validate new password strength
    if (newPassword.length < 6) {
      return { success: false, error: "New password must be at least 6 characters." };
    }

    // Prevent setting same password
    if (verifyPassword(newPassword, auth.passwordHash)) {
      return { success: false, error: "New password must be different from current password." };
    }

    // Update password
    auth.passwordHash = hashPassword(newPassword);
    auth.updatedAt = new Date().toISOString();

    const success = saveToStorage(USER_AUTH_KEY, auth);
    if (!success) {
      return { success: false, error: "Failed to save password to storage" };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Authenticate user with username and password
 * @param {string} username - Username to check
 * @param {string} password - Password to verify (plain)
 * @returns {object} { authenticated: boolean, user?: object, error?: string }
 */
export const authenticateUser = (username, password) => {
  try {
    const auth = getUserAuth();

    if (!username || username.trim() !== auth.username) {
      return { authenticated: false, error: "Username not found." };
    }

    if (!password || !verifyPassword(password, auth.passwordHash)) {
      return { authenticated: false, error: "Password is incorrect." };
    }

    // Return user data without password hash
    const userPublic = {
      username: auth.username,
      email: auth.email,
      phone: auth.phone,
      createdAt: auth.createdAt,
    };

    return { authenticated: true, user: userPublic };
  } catch (error) {
    return { authenticated: false, error: error.message };
  }
};

/**
 * Reset password to default (for demo purposes)
 * Current default: "password123"
 * @returns {object} { success: boolean, error?: string }
 */
export const resetPasswordToDefault = () => {
  try {
    const auth = getUserAuth();
    auth.passwordHash = hashPassword("password123");
    auth.updatedAt = new Date().toISOString();

    const success = saveToStorage(USER_AUTH_KEY, auth);
    return success
      ? { success: true }
      : { success: false, error: "Failed to reset password" };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
