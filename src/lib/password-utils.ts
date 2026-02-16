export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;

export type PasswordStrengthLevel = "weak" | "fair" | "good" | "strong";

export interface PasswordStrength {
  level: PasswordStrengthLevel;
  score: number;
  label: string;
  color: string;
  barWidth: string;
}

export function getPasswordStrength(password: string): PasswordStrength {
  if (!password.length) {
    return { level: "weak", score: 0, label: "Enter a password", color: "text-[#E5E7EB]/50", barWidth: "w-0" };
  }

  let score = 0;
  if (password.length >= PASSWORD_MIN_LENGTH) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  const cappedScore = Math.min(score, 4);

  const level: PasswordStrengthLevel =
    cappedScore <= 1 ? "weak" : cappedScore === 2 ? "fair" : cappedScore === 3 ? "good" : "strong";
  const labels: Record<PasswordStrengthLevel, string> = {
    weak: "Weak",
    fair: "Fair",
    good: "Good",
    strong: "Strong",
  };
  const colors: Record<PasswordStrengthLevel, string> = {
    weak: "text-red-400",
    fair: "text-amber-400",
    good: "text-[#00D4FF]",
    strong: "text-green-400",
  };
  const barWidths: Record<PasswordStrengthLevel, string> = {
    weak: "w-1/4",
    fair: "w-2/4",
    good: "w-3/4",
    strong: "w-full",
  };

  return {
    level,
    score: cappedScore,
    label: labels[level],
    color: colors[level],
    barWidth: barWidths[level],
  };
}
