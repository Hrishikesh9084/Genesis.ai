export function validateEmail(email) {
  const value = String(email || "").trim();
  // Basic, reliable email check for client-side validation.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function validateRegisterInput({ name, email, password }) {
  if (!String(name || "").trim()) {
    return "Name is required.";
  }

  if (!validateEmail(email)) {
    return "Please enter a valid email address.";
  }

  if (String(password || "").length < 6) {
    return "Password must be at least 6 characters.";
  }

  return null;
}

export function validateLoginInput({ email, password }) {
  if (!validateEmail(email)) {
    return "Please enter a valid email address.";
  }

  if (!String(password || "").trim()) {
    return "Password is required.";
  }

  return null;
}

export function validateProjectInput({ name, prompt }) {
  if (!String(name || "").trim()) {
    return "Project name is required.";
  }

  const cleanPrompt = String(prompt || "").trim();
  if (!cleanPrompt) {
    return "Project description is required.";
  }

  if (cleanPrompt.length < 20) {
    return "Project description should be at least 20 characters for better generation results.";
  }

  return null;
}

export function validateEditPrompt(prompt) {
  const value = String(prompt || "").trim();

  if (!value) {
    return "Please describe the changes you want.";
  }

  if (value.length < 10) {
    return "Edit description should be at least 10 characters.";
  }

  return null;
}
