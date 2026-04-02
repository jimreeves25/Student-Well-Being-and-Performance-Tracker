import { loadFromStorage, saveToStorage } from "./storage";
import { hashPassword, verifyPassword } from "./passwordUtils";

const USER_AUTH_KEY = "userAuth";

export const initializeUserAuth = () => {
  let auth = loadFromStorage(USER_AUTH_KEY, null);
  if (!auth) {
    auth = {
      username: "Student User",
      email: "student@example.com",
      phone: "",
      passwordHash: hashPassword("password123"),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveToStorage(USER_AUTH_KEY, auth);
  }
  return auth;
};

export const getUserAuth = () => {
  return loadFromStorage(USER_AUTH_KEY, null) || initializeUserAuth();
};

export const updateUserProfile = (updates) => {
  try {
    const auth = getUserAuth();
    if (updates.username) auth.username = updates.username.trim();
    if (updates.email) auth.email = updates.email.trim();
    if (updates.phone !== undefined) auth.phone = (updates.phone || "").trim();
    auth.updatedAt = new Date().toISOString();
    const success = saveToStorage(USER_AUTH_KEY, auth);
    if (!success) return { success: false, error: "Failed to save profile." };
    return { success: true, data: auth };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const changePassword = (currentPassword, newPassword) => {
  try {
    if (!currentPassword || !currentPassword.trim()) {
      return { success: false, error: "Current password is required." };
    }
    if (!newPassword || !newPassword.trim()) {
      return { success: false, error: "New password is required." };
    }

    localStorage.removeItem("userPassword");

    const auth = getUserAuth();
    const isCorrect = verifyPassword(currentPassword, auth.passwordHash);

    if (!isCorrect) {
      return { success: false, error: "Current password is incorrect." };
    }

    auth.passwordHash = hashPassword(newPassword);
    auth.updatedAt = new Date().toISOString();

    const saved = saveToStorage(USER_AUTH_KEY, auth);
    if (!saved) return { success: false, error: "Failed to save new password." };

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const authenticateUser = (username, password) => {
  try {
    const auth = getUserAuth();
    if (!username || username.trim() !== auth.username) {
      return { authenticated: false, error: "Username not found." };
    }
    if (!password || !verifyPassword(password, auth.passwordHash)) {
      return { authenticated: false, error: "Password is incorrect." };
    }
    return {
      authenticated: true,
      user: {
        username: auth.username,
        email: auth.email,
        phone: auth.phone,
        createdAt: auth.createdAt,
      },
    };
  } catch (error) {
    return { authenticated: false, error: error.message };
  }
};

export const resetPasswordToDefault = () => {
  try {
    const auth = getUserAuth();
    auth.passwordHash = hashPassword("password123");
    auth.updatedAt = new Date().toISOString();
    const success = saveToStorage(USER_AUTH_KEY, auth);
    return success
      ? { success: true }
      : { success: false, error: "Failed to reset password." };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
