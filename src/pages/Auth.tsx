import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { User, Session } from "@supabase/supabase-js";
import { BarChart3, Sparkles, Mail, Lock, ArrowRight, Eye, EyeOff } from "lucide-react";
import LoggerService from "@/services/LoggerService";
import { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH, getPasswordStrength } from "@/lib/password-utils";

const EMAIL_MAX_LENGTH = 254;

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Set up auth state listener FIRST
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      // Log auth state changes
      if (event === 'SIGNED_IN') {
        LoggerService.info('Auth', 'SIGNED_IN', 'User signed in', { userId: session?.user?.id });
      } else if (event === 'SIGNED_OUT') {
        LoggerService.info('Auth', 'SIGNED_OUT', 'User signed out');
      }
    });

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      navigate("/data-sources");
    }
  }, [user, navigate]);

  const handleEmailChange = (value: string) => {
    const filtered = value.replace(/[^a-zA-Z0-9._%+\-@]/g, "").slice(0, EMAIL_MAX_LENGTH);
    setEmail(filtered);
    if (emailError) setEmailError("");
  };

  const validateEmailFormat = (): boolean => {
    const trimmed = email.trim();
    if (!trimmed) {
      setEmailError("Email is required");
      return false;
    }
    if (trimmed.length > EMAIL_MAX_LENGTH) {
      setEmailError(`Email must be at most ${EMAIL_MAX_LENGTH} characters`);
      return false;
    }
    const basicEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!basicEmailRegex.test(trimmed)) {
      setEmailError("Please enter a valid email address");
      return false;
    }
    setEmailError("");
    return true;
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError("");
    if (!validateEmailFormat()) {
      toast.error("Please enter a valid email address");
      return;
    }
    if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
      toast.error(`Password must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters`);
      return;
    }
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        toast.success("Logged in successfully!");
        LoggerService.action('Auth', 'LOGIN_SUCCESS', 'User logged in successfully', { email });
      } else {
        const redirectUrl = `${window.location.origin}/`;
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: redirectUrl,
          },
        });
        if (error) throw error;
        toast.success("Account created! You can now log in.");
        LoggerService.action('Auth', 'SIGNUP_SUCCESS', 'User signed up successfully', { email });
        setIsLogin(true);
      }
    } catch (error) {
      const err = error as Error;
      const errorMessage = err.message || "Authentication failed";
      const isInvalidCredentials =
        isLogin &&
        (errorMessage.toLowerCase().includes("invalid login credentials") ||
          errorMessage.toLowerCase().includes("invalid_credentials") ||
          errorMessage.toLowerCase().includes("email not confirmed"));
      if (isInvalidCredentials) {
        const friendlyMessage = "This email is not registered or password is incorrect. Please sign up if you don't have an account.";
        setEmailError("This email is not registered or password is incorrect.");
        toast.error(friendlyMessage);
      } else {
        toast.error(errorMessage);
      }
      LoggerService.error('Auth', isLogin ? 'LOGIN_FAILED' : 'SIGNUP_FAILED', errorMessage, error, { email });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0E27] text-white overflow-hidden relative flex items-center justify-center p-4">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0A0E27] via-[#1a1f3a] to-[#0A0E27]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(0,212,255,0.1),transparent_50%)]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(107,70,193,0.15),transparent_50%)]"></div>
      </div>

      {/* Floating Particles */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(15)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-[#00D4FF] rounded-full opacity-40 animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${5 + Math.random() * 5}s`,
            }}
          />
        ))}
      </div>

      {/* Main Content */}
      <div className="relative z-10 w-full max-w-md">
        {/* Premium Glass Card */}
        <div className="glass-card p-8 rounded-2xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] backdrop-blur-xl">
          {/* Header */}
          <div className="text-center mb-8 space-y-4">
            {/* Logo and Icons */}
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="relative">
                <img
                  src="/logo-sfw.png"
                  alt="SFW ZERRA"
                  className={`transition-all duration-300 object-contain h-15 w-15`}
                />
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-br from-[#00D4FF] to-[#6B46C1] rounded-full animate-pulse-slow"></div>
              </div>
            </div>

            {/* Welcome Message */}
            <p className="text-[#E5E7EB]/70 text-lg">
              {isLogin ? "Welcome back! Sign in to continue" : "Create your account to get started"}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleAuth} className="space-y-6">
            {/* Email Input */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[#E5E7EB] text-sm font-medium flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#00D4FF]" />
                Email
              </Label>
              <div className="relative">
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  maxLength={EMAIL_MAX_LENGTH}
                  required
                  className={`bg-white/5 border-white/20 text-white placeholder:text-[#E5E7EB]/40 focus:border-[#00D4FF] focus:ring-[#00D4FF]/20 h-12 rounded-lg backdrop-blur-sm transition-all ${emailError ? "border-red-500/50 focus:ring-red-500/20" : ""}`}
                />
                <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-[#00D4FF]/0 via-[#00D4FF]/0 to-[#6B46C1]/0 opacity-0 hover:opacity-10 transition-opacity pointer-events-none"></div>
              </div>
              {emailError && (
                <p className="text-sm text-red-400" role="alert">
                  {emailError}
                </p>
              )}
              <p className="text-xs text-[#E5E7EB]/50">
                Maximum {EMAIL_MAX_LENGTH} characters. Only letters, numbers, and @ . _ % + - allowed.
              </p>
            </div>

            {/* Password Input */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-[#E5E7EB] text-sm font-medium flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#00D4FF]" />
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    const val = e.target.value.slice(0, PASSWORD_MAX_LENGTH);
                    setPassword(val);
                  }}
                  minLength={PASSWORD_MIN_LENGTH}
                  maxLength={PASSWORD_MAX_LENGTH}
                  required
                  className="bg-white/5 border-white/20 text-white placeholder:text-[#E5E7EB]/40 focus:border-[#00D4FF] focus:ring-[#00D4FF]/20 h-12 rounded-lg backdrop-blur-sm transition-all pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#E5E7EB]/60 hover:text-[#00D4FF] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00D4FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0E27] rounded p-1"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
                <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-[#00D4FF]/0 via-[#00D4FF]/0 to-[#6B46C1]/0 opacity-0 hover:opacity-10 transition-opacity pointer-events-none"></div>
              </div>
              <p className="text-xs text-[#E5E7EB]/50">
                Minimum {PASSWORD_MIN_LENGTH} characters, maximum {PASSWORD_MAX_LENGTH} characters.
              </p>
              {password.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex gap-1 h-1.5 rounded-full overflow-hidden bg-white/10">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        getPasswordStrength(password).level === "weak"
                          ? "bg-red-400"
                          : getPasswordStrength(password).level === "fair"
                            ? "bg-amber-400"
                            : getPasswordStrength(password).level === "good"
                              ? "bg-[#00D4FF]"
                              : "bg-green-400"
                      }`}
                      style={{ width: `${(getPasswordStrength(password).score / 4) * 100}%` }}
                    />
                  </div>
                  <p className={`text-xs font-medium ${getPasswordStrength(password).color}`}>
                    Password strength: {getPasswordStrength(password).label}
                  </p>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-[#00D4FF] to-[#6B46C1] hover:from-[#00D4FF]/90 hover:to-[#6B46C1]/90 text-white text-lg px-8 py-6 rounded-lg shadow-[0_0_30px_rgba(0,212,255,0.3)] hover:shadow-[0_0_40px_rgba(0,212,255,0.5)] transition-all duration-300 font-semibold group"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Processing...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  {isLogin ? "Sign In" : "Sign Up"}
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </span>
              )}
            </Button>

            {/* Toggle Login/Signup */}
            <div className="text-center pt-4">
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-[#E5E7EB]/70 hover:text-[#00D4FF] transition-colors text-sm group"
              >
                {isLogin ? (
                  <>
                    Need an account? <span className="text-[#00D4FF] font-semibold group-hover:underline">Sign up</span>
                  </>
                ) : (
                  <>
                    Already have an account? <span className="text-[#00D4FF] font-semibold group-hover:underline">Sign in</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Trust Badges */}
          <div className="mt-8 pt-6 border-t border-white/10">
            <div className="flex items-center justify-center gap-6 text-xs text-[#E5E7EB]/60">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#00D4FF] animate-pulse"></div>
                <span>Enterprise Security</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#6B46C1] animate-pulse" style={{ animationDelay: '0.5s' }}></div>
                <span>GDPR Compliant</span>
              </div>
            </div>
          </div>
        </div>

        {/* Floating UI Elements */}
        <div className="absolute -top-4 -right-4 w-20 h-20 bg-gradient-to-br from-[#00D4FF] to-[#6B46C1] rounded-xl shadow-[0_0_30px_rgba(0,212,255,0.5)] animate-float-slow opacity-20 pointer-events-none"></div>
        <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-gradient-to-br from-[#6B46C1] to-[#9333EA] rounded-lg shadow-[0_0_20px_rgba(107,70,193,0.5)] animate-float-slow opacity-20 pointer-events-none" style={{ animationDelay: "1s" }}></div>
      </div>
    </div>
  );
};

export default Auth;
