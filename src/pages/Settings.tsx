import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  ClipboardList,
  Copy,
  Database,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Filter,
  Globe,
  Key,
  Loader2,
  Mail,
  Moon,
  Plus,
  Save,
  Search,
  Shield,
  Sun,
  Trash2,
  User,
} from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import * as XLSX from "xlsx";

interface LogEntry {
  id: string;
  created_at: string;
  user_id: string;
  user_email?: string;
  action: string;
  module: string;
  level: string;
  message: string;
  metadata: any;
  error_stack?: string;
}

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  metadata: any;
  created_at: string;
  last_login_at: string | null;
  tenant_id: string | null;
}

interface TenantInfo {
  id: string;
  name: string;
  subscription_tier: string;
  status: string;
}

const Settings = () => {
  const [activeTab, setActiveTab] = useState("profile");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [tenantInfo, setTenantInfo] = useState<TenantInfo | null>(null);

  // Profile form state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  // Preferences state
  const [theme, setTheme] = useState<"light" | "dark" | "system">("dark");
  const [language, setLanguage] = useState("en");
  const [notifications, setNotifications] = useState({
    email: true,
    push: false,
    modelTraining: true,
    dataSync: true,
    alerts: true,
  });

  // Privacy state
  const [gdprConsents, setGdprConsents] = useState<any[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // API keys state
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [newApiKeyName, setNewApiKeyName] = useState("");

  // Audit Logs state
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logFilter, setLogFilter] = useState("all");

  useEffect(() => {
    loadUserData();
  }, []);

  // Load logs when the tab is active
  useEffect(() => {
    if (activeTab === "audit") {
      loadLogs();
    }
  }, [activeTab, logFilter]);

  const loadLogs = async () => {
    try {
      setLogsLoading(true);
      let query = supabase
        .from("logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (logFilter !== "all") {
        query = query.eq("level", logFilter);
      }

      const { data: logsData, error } = await query;

      if (error) throw error;

      // Fetch user emails
      const userIds = [
        ...new Set(
          (logsData || []).map((log) => log.user_id).filter((id) =>
            id && id !== "anonymous"
          ),
        ),
      ];
      let userMap: Record<string, string> = {};

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("user_profiles")
          .select("id, email")
          .in("id", userIds);

        if (profiles) {
          profiles.forEach((p) => {
            userMap[p.id] = p.email;
          });
        }
      }

      const enrichedLogs = (logsData || []).map((log) => ({
        ...log,
        user_email: userMap[log.user_id] ||
          (log.user_id === "anonymous" ? "Anonymous" : "Unknown"),
        action: log.action_type,
        // Handle potential null values to match LogEntry interface
        module: log.module || "System",
        level: log.level || "info",
        message: log.message || "",
        metadata: log.metadata || {},
        user_id: log.user_id || "unknown",
      }));

      setLogs(enrichedLogs as LogEntry[]);
    } catch (error: any) {
      console.error("Error loading logs:", error);
      toast.error("Failed to load audit logs");
    } finally {
      setLogsLoading(false);
    }
  };

  const handleSimulateError = () => {
    try {
      // Simulate a complex error
      const simulateCrash = () => {
        throw new Error("This is a simulated test error for the Audit Logs!");
      };
      simulateCrash();
    } catch (error: any) {
      // Log it manually since we caught it, or let it bubble up if we want global handler
      // Here we explicitly use LoggerService to ensure it saves
      import("@/services/LoggerService").then(({ default: LoggerService }) => {
        LoggerService.error(
          "System",
          "Test Error",
          "User simulated an error",
          error,
        );
        toast.success("Test error logged. Refresh the table to see it.");

        // Refresh logs after a short delay
        setTimeout(loadLogs, 1000);
      });
    }
  };

  const handleExportLogs = () => {
    if (logs.length === 0) {
      toast.error("No logs to export");
      return;
    }

    const exportData = logs.map((log) => {
      const dateObj = new Date(log.created_at);
      return {
        "User ID": log.user_id,
        "Email": log.user_email || "N/A",
        "Date": dateObj.toLocaleDateString("en-US", { timeZone: "UTC" }),
        "Time": dateObj.toLocaleTimeString("en-US", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          fractionalSecondDigits: 3,
          timeZone: "UTC",
        } as any),
        "Timezone": "UTC",
        "Action Type": log.action,
        "Module": log.module,
        "Level": log.level.toUpperCase(),
        "Message": log.message,
        "Data": JSON.stringify(log.metadata || {}),
        "Error Stack": log.error_stack || "N/A",
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Audit Logs");
    XLSX.writeFile(
      wb,
      `audit_logs_${new Date().toISOString().split("T")[0]}.xlsx`,
    );
    toast.success("Logs exported successfully");
  };

  const loadUserData = async () => {
    try {
      setLoading(true);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please log in to view settings");
        return;
      }

      // Get user profile
      const { data: profileData, error: profileError } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileError) {
        console.error("Error loading profile:", profileError);
        toast.error("Failed to load profile");
        return;
      }

      const profile = profileData as unknown as UserProfile;

      setUserProfile(profile);
      setFullName(profile.full_name || "");
      setEmail(profile.email || user.email || "");
      setAvatarUrl(profile.avatar_url || "");

      // Get tenant info
      if (profile.tenant_id) {
        const { data: tenant, error: tenantError } = await supabase
          .from("tenants")
          .select("*")
          .eq("id", profile.tenant_id)
          .single();

        if (!tenantError && tenant) {
          setTenantInfo(tenant);
        }
      }

      // Load preferences from metadata
      if (profile.metadata) {
        const metadata = profile.metadata as any;
        if (metadata.theme) setTheme(metadata.theme);
        if (metadata.language) setLanguage(metadata.language);
        if (metadata.notifications) {
          setNotifications(metadata.notifications);
        }
        if (metadata.api_keys) {
          setApiKeys(metadata.api_keys);
        }
      }

      // Load GDPR consents
      const { data: consents } = await supabase
        .from("gdpr_consents")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (consents) {
        setGdprConsents(consents);
      }
    } catch (error) {
      console.error("Error loading user data:", error);
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!userProfile) return;

    try {
      setSaving(true);

      const { error } = await supabase
        .from("user_profiles")
        .update({
          full_name: fullName || null,
          email: email,
          avatar_url: avatarUrl || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userProfile.id);

      if (error) throw error;

      // Update auth email if changed
      if (email !== userProfile.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: email,
        });
        if (emailError) {
          console.error("Error updating email:", emailError);
          toast.warning(
            "Profile updated but email change requires verification",
          );
        }
      }

      toast.success("Profile updated successfully");
      await loadUserData();
    } catch (error: any) {
      console.error("Error saving profile:", error);
      toast.error(error.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleSavePreferences = async () => {
    if (!userProfile) return;

    try {
      setSaving(true);

      const { error } = await supabase
        .from("user_profiles")
        .update({
          metadata: {
            ...userProfile.metadata,
            theme,
            language,
            notifications,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", userProfile.id);

      if (error) throw error;

      // Apply theme
      if (theme === "dark") {
        document.documentElement.classList.add("dark");
      } else if (theme === "light") {
        document.documentElement.classList.remove("dark");
      }

      toast.success("Preferences saved successfully");
      await loadUserData();
    } catch (error: any) {
      console.error("Error saving preferences:", error);
      toast.error(error.message || "Failed to save preferences");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    try {
      setSaving(true);

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast.success("Password changed successfully");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      console.error("Error changing password:", error);
      toast.error(error.message || "Failed to change password");
    } finally {
      setSaving(false);
    }
  };

  const handleRequestDataExport = async () => {
    try {
      setSaving(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !userProfile) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gdpr`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${
              (await supabase.auth.getSession()).data.session?.access_token
            }`,
          },
          body: JSON.stringify({
            action: "access",
            user_id: user.id,
          }),
        },
      );

      if (!response.ok) throw new Error("Failed to request data export");

      const result = await response.json();
      toast.success(
        "Data export requested. You will receive an email when ready.",
      );
    } catch (error: any) {
      console.error("Error requesting data export:", error);
      toast.error(error.message || "Failed to request data export");
    } finally {
      setSaving(false);
    }
  };

  const handleRequestDataDeletion = async () => {
    if (
      !confirm(
        "Are you sure you want to delete all your data? This action cannot be undone.",
      )
    ) {
      return;
    }

    try {
      setSaving(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !userProfile) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gdpr`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${
              (await supabase.auth.getSession()).data.session?.access_token
            }`,
          },
          body: JSON.stringify({
            action: "deletion",
            user_id: user.id,
          }),
        },
      );

      if (!response.ok) throw new Error("Failed to request data deletion");

      toast.success(
        "Data deletion requested. You will receive a confirmation email.",
      );
    } catch (error: any) {
      console.error("Error requesting data deletion:", error);
      toast.error(error.message || "Failed to request data deletion");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateConsent = async (consentType: string, granted: boolean) => {
    try {
      setSaving(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !userProfile) return;

      const { error } = await supabase
        .from("gdpr_consents")
        .upsert({
          user_id: user.id,
          tenant_id: userProfile.tenant_id,
          consent_type: consentType,
          granted: granted,
          version: "1.0",
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      toast.success("Consent updated successfully");
      await loadUserData();
    } catch (error: any) {
      console.error("Error updating consent:", error);
      toast.error(error.message || "Failed to update consent");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0E27] text-white p-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#00D4FF]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0E27] text-white p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold mb-2">
            <span className="bg-gradient-to-r from-[#00D4FF] to-[#6B46C1] bg-clip-text text-transparent">
              Settings
            </span>
          </h1>
          <p className="text-[#E5E7EB]/70 text-lg">
            Manage your account and preferences
          </p>
        </div>

        {/* Settings Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-6"
        >
          <TabsList className="glass-card bg-white/5 border-white/10 p-1">
            <TabsTrigger
              value="profile"
              className="data-[state=active]:bg-[#00D4FF]/20"
            >
              <User className="w-4 h-4 mr-2" />
              Profile
            </TabsTrigger>
            <TabsTrigger
              value="account"
              className="data-[state=active]:bg-[#00D4FF]/20"
            >
              <Shield className="w-4 h-4 mr-2" />
              Account
            </TabsTrigger>
            <TabsTrigger
              value="preferences"
              className="data-[state=active]:bg-[#00D4FF]/20"
            >
              <Globe className="w-4 h-4 mr-2" />
              Preferences
            </TabsTrigger>
            <TabsTrigger
              value="notifications"
              className="data-[state=active]:bg-[#00D4FF]/20"
            >
              <Bell className="w-4 h-4 mr-2" />
              Notifications
            </TabsTrigger>
            <TabsTrigger
              value="privacy"
              className="data-[state=active]:bg-[#00D4FF]/20"
            >
              <Database className="w-4 h-4 mr-2" />
              Privacy
            </TabsTrigger>
            <TabsTrigger
              value="audit"
              className="data-[state=active]:bg-[#00D4FF]/20"
            >
              <ClipboardList className="w-4 h-4 mr-2" />
              Audit Logs
            </TabsTrigger>
            <TabsTrigger
              value="api"
              className="data-[state=active]:bg-[#00D4FF]/20"
            >
              <Key className="w-4 h-4 mr-2" />
              API
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <Card className="glass-card p-6 border-white/10">
              <h2 className="text-2xl font-bold mb-6">Profile Information</h2>
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="bg-white/5 border-white/20 text-white"
                    placeholder="Enter your full name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-white/5 border-white/20 text-white"
                    placeholder="Enter your email"
                  />
                  <p className="text-sm text-[#E5E7EB]/50">
                    Changing your email will require verification
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="avatarUrl">Avatar URL</Label>
                  <Input
                    id="avatarUrl"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    className="bg-white/5 border-white/20 text-white"
                    placeholder="https://example.com/avatar.jpg"
                  />
                </div>

                {tenantInfo && (
                  <div className="space-y-2">
                    <Label>Organization</Label>
                    <div className="flex items-center gap-2">
                      <p className="text-white">{tenantInfo.name}</p>
                      <Badge className="bg-[#6B46C1]/20 text-[#6B46C1] border-[#6B46C1]/30">
                        {tenantInfo.subscription_tier}
                      </Badge>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Role</Label>
                  <Badge className="bg-[#00D4FF]/20 text-[#00D4FF] border-[#00D4FF]/30">
                    {userProfile?.role || "viewer"}
                  </Badge>
                </div>

                <Button
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="bg-gradient-to-r from-[#00D4FF] to-[#6B46C1] hover:from-[#00D4FF]/90 hover:to-[#6B46C1]/90"
                >
                  {saving
                    ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    )
                    : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Save Changes
                      </>
                    )}
                </Button>
              </div>
            </Card>
          </TabsContent>

          {/* Account Tab */}
          <TabsContent value="account">
            <Card className="glass-card p-6 border-white/10">
              <h2 className="text-2xl font-bold mb-6">Account Security</h2>
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Change Password</h3>
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <div className="relative">
                      <Input
                        id="newPassword"
                        type={showPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="bg-white/5 border-white/20 text-white pr-10"
                        placeholder="Enter new password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#E5E7EB]/50 hover:text-white"
                      >
                        {showPassword
                          ? <EyeOff className="w-4 h-4" />
                          : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <Input
                      id="confirmPassword"
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="bg-white/5 border-white/20 text-white"
                      placeholder="Confirm new password"
                    />
                  </div>
                  <Button
                    onClick={handleChangePassword}
                    disabled={saving || !newPassword || !confirmPassword}
                    className="bg-gradient-to-r from-[#00D4FF] to-[#6B46C1] hover:from-[#00D4FF]/90 hover:to-[#6B46C1]/90"
                  >
                    {saving
                      ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Changing...
                        </>
                      )
                      : (
                        "Change Password"
                      )}
                  </Button>
                </div>

                <Separator className="bg-white/10" />

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Account Information</h3>
                  <div className="space-y-2">
                    <Label>Account Created</Label>
                    <p className="text-[#E5E7EB]/70">
                      {userProfile?.created_at
                        ? new Date(userProfile.created_at).toLocaleDateString()
                        : "N/A"}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Last Login</Label>
                    <p className="text-[#E5E7EB]/70">
                      {userProfile?.last_login_at
                        ? new Date(userProfile.last_login_at).toLocaleString()
                        : "Never"}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Preferences Tab */}
          <TabsContent value="preferences">
            <Card className="glass-card p-6 border-white/10">
              <h2 className="text-2xl font-bold mb-6">Preferences</h2>
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="theme">Theme</Label>
                  <Select
                    value={theme}
                    onValueChange={(value: any) => setTheme(value)}
                  >
                    <SelectTrigger className="bg-white/5 border-white/20 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a1f3a] border-white/10">
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="language">Language</Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger className="bg-white/5 border-white/20 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#1a1f3a] border-white/10">
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="es">Spanish</SelectItem>
                      <SelectItem value="fr">French</SelectItem>
                      <SelectItem value="de">German</SelectItem>
                      <SelectItem value="zh">Chinese</SelectItem>
                      <SelectItem value="ja">Japanese</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={handleSavePreferences}
                  disabled={saving}
                  className="bg-gradient-to-r from-[#00D4FF] to-[#6B46C1] hover:from-[#00D4FF]/90 hover:to-[#6B46C1]/90"
                >
                  {saving
                    ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    )
                    : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Save Preferences
                      </>
                    )}
                </Button>
              </div>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications">
            <Card className="glass-card p-6 border-white/10">
              <h2 className="text-2xl font-bold mb-6">
                Notification Preferences
              </h2>
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Email Notifications</Label>
                    <p className="text-sm text-[#E5E7EB]/50">
                      Receive notifications via email
                    </p>
                  </div>
                  <Switch
                    checked={notifications.email}
                    onCheckedChange={(checked) =>
                      setNotifications({ ...notifications, email: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Push Notifications</Label>
                    <p className="text-sm text-[#E5E7EB]/50">
                      Receive browser push notifications
                    </p>
                  </div>
                  <Switch
                    checked={notifications.push}
                    onCheckedChange={(checked) =>
                      setNotifications({ ...notifications, push: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Model Training Complete</Label>
                    <p className="text-sm text-[#E5E7EB]/50">
                      Get notified when ML models finish training
                    </p>
                  </div>
                  <Switch
                    checked={notifications.modelTraining}
                    onCheckedChange={(checked) =>
                      setNotifications({
                        ...notifications,
                        modelTraining: checked,
                      })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Data Sync Complete</Label>
                    <p className="text-sm text-[#E5E7EB]/50">
                      Get notified when data sources finish syncing
                    </p>
                  </div>
                  <Switch
                    checked={notifications.dataSync}
                    onCheckedChange={(checked) =>
                      setNotifications({ ...notifications, dataSync: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>System Alerts</Label>
                    <p className="text-sm text-[#E5E7EB]/50">
                      Receive important system alerts and updates
                    </p>
                  </div>
                  <Switch
                    checked={notifications.alerts}
                    onCheckedChange={(checked) =>
                      setNotifications({ ...notifications, alerts: checked })}
                  />
                </div>

                <Button
                  onClick={handleSavePreferences}
                  disabled={saving}
                  className="bg-gradient-to-r from-[#00D4FF] to-[#6B46C1] hover:from-[#00D4FF]/90 hover:to-[#6B46C1]/90"
                >
                  {saving
                    ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    )
                    : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Save Notification Settings
                      </>
                    )}
                </Button>
              </div>
            </Card>
          </TabsContent>

          {/* Privacy Tab */}
          <TabsContent value="privacy">
            <Card className="glass-card p-6 border-white/10">
              <h2 className="text-2xl font-bold mb-6">Privacy & Data</h2>
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">
                    GDPR Consent Management
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                      <div className="space-y-0.5">
                        <Label>Data Processing</Label>
                        <p className="text-sm text-[#E5E7EB]/50">
                          Allow processing of your data for analytics
                        </p>
                      </div>
                      <Switch
                        checked={gdprConsents.find((c) =>
                          c.consent_type === "data_processing"
                        )
                          ?.granted || false}
                        onCheckedChange={(checked) =>
                          handleUpdateConsent("data_processing", checked)}
                        disabled={saving}
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                      <div className="space-y-0.5">
                        <Label>Marketing Communications</Label>
                        <p className="text-sm text-[#E5E7EB]/50">
                          Receive marketing emails and updates
                        </p>
                      </div>
                      <Switch
                        checked={gdprConsents.find((c) =>
                          c.consent_type === "marketing"
                        )?.granted ||
                          false}
                        onCheckedChange={(checked) =>
                          handleUpdateConsent("marketing", checked)}
                        disabled={saving}
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                      <div className="space-y-0.5">
                        <Label>Analytics & Tracking</Label>
                        <p className="text-sm text-[#E5E7EB]/50">
                          Allow usage analytics and tracking
                        </p>
                      </div>
                      <Switch
                        checked={gdprConsents.find((c) =>
                          c.consent_type === "analytics"
                        )?.granted ||
                          false}
                        onCheckedChange={(checked) =>
                          handleUpdateConsent("analytics", checked)}
                        disabled={saving}
                      />
                    </div>
                  </div>
                </div>

                <Separator className="bg-white/10" />

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Data Management</h3>
                  <div className="space-y-3">
                    <Button
                      onClick={handleRequestDataExport}
                      disabled={saving}
                      variant="outline"
                      className="w-full border-[#00D4FF]/30 text-[#00D4FF] hover:bg-[#00D4FF]/10"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Export My Data
                    </Button>
                    <Button
                      onClick={handleRequestDataDeletion}
                      disabled={saving}
                      variant="outline"
                      className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Request Data Deletion
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Audit Logs Tab */}
          <TabsContent value="audit">
            <Card className="glass-card p-6 border-white/10">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                <div className="space-y-1">
                  <h2 className="text-2xl font-bold">Audit Logs</h2>
                  <p className="text-sm text-[#E5E7EB]/50">
                    View system activities and user actions
                  </p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative w-full sm:w-[200px]">
                    <Select value={logFilter} onValueChange={setLogFilter}>
                      <SelectTrigger className="bg-white/5 border-white/20 text-white">
                        <SelectValue placeholder="Filter by Level" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a1f3a] border-white/10">
                        <SelectItem value="all">All Levels</SelectItem>
                        <SelectItem value="info">Info</SelectItem>
                        <SelectItem value="warning">Warning</SelectItem>
                        <SelectItem value="error">Error</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={handleSimulateError}
                    variant="outline"
                    className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                  >
                    <AlertCircle className="w-4 h-4 mr-2" />
                    Test Error
                  </Button>
                  <Button
                    onClick={handleExportLogs}
                    variant="outline"
                    className="border-[#00D4FF]/30 text-[#00D4FF] hover:bg-[#00D4FF]/10"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </Button>
                </div>
              </div>

              <div className="rounded-md border border-white/10 bg-white/5 overflow-x-auto">
                <Table className="min-w-[1200px]">
                  <TableHeader className="bg-white/5">
                    <TableRow className="border-white/10 hover:bg-white/5">
                      <TableHead className="text-[#E5E7EB] w-[100px]">
                        Date
                      </TableHead>
                      <TableHead className="text-[#E5E7EB] w-[100px]">
                        Time
                      </TableHead>
                      <TableHead className="text-[#E5E7EB] w-[120px]">
                        Timezone
                      </TableHead>
                      <TableHead className="text-[#E5E7EB] w-[200px]">
                        Email
                      </TableHead>
                      <TableHead className="text-[#E5E7EB] w-[80px]">
                        Level
                      </TableHead>
                      <TableHead className="text-[#E5E7EB] w-[100px]">
                        Module
                      </TableHead>
                      <TableHead className="text-[#E5E7EB] w-[120px]">
                        Action
                      </TableHead>
                      <TableHead className="text-[#E5E7EB] w-[200px]">
                        Message
                      </TableHead>
                      <TableHead className="text-[#E5E7EB] w-[200px]">
                        Data
                      </TableHead>
                      <TableHead className="text-[#E5E7EB] w-[150px]">
                        Error Stack
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logsLoading
                      ? (
                        <TableRow>
                          <TableCell colSpan={10} className="h-24 text-center">
                            <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#00D4FF]" />
                          </TableCell>
                        </TableRow>
                      )
                      : logs.length === 0
                      ? (
                        <TableRow>
                          <TableCell
                            colSpan={10}
                            className="h-24 text-center text-[#E5E7EB]/50"
                          >
                            No logs found
                          </TableCell>
                        </TableRow>
                      )
                      : (
                        logs.map((log) => {
                          const dateObj = new Date(log.created_at);
                          const dateStr = dateObj.toLocaleDateString("en-US", {
                            timeZone: "UTC",
                          });
                          const timeStr = dateObj.toLocaleTimeString("en-US", {
                            hour12: false,
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                            fractionalSecondDigits: 3,
                            timeZone: "UTC",
                          } as any);
                          const timeZone = "UTC";

                          return (
                            <TableRow
                              key={log.id}
                              className="border-white/10 hover:bg-white/5"
                            >
                              <TableCell className="text-[#E5E7EB]/70 font-mono text-xs">
                                {dateStr}
                              </TableCell>
                              <TableCell className="text-[#E5E7EB]/70 font-mono text-xs">
                                {timeStr}
                              </TableCell>
                              <TableCell className="text-[#E5E7EB]/70 text-xs">
                                {timeZone}
                              </TableCell>
                              <TableCell
                                className="text-[#E5E7EB]/70 text-xs truncate max-w-[150px]"
                                title={log.user_email}
                              >
                                {log.user_email}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  className={`
                                  ${
                                    log.level === "error"
                                      ? "bg-red-500/20 text-red-400 border-red-500/30"
                                      : log.level === "warning"
                                      ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                                      : "bg-[#00D4FF]/20 text-[#00D4FF] border-[#00D4FF]/30"
                                  }
                                `}
                                >
                                  {log.level}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-[#E5E7EB] text-xs">
                                {log.module}
                              </TableCell>
                              <TableCell className="text-[#E5E7EB] text-xs font-medium">
                                {log.action}
                              </TableCell>
                              <TableCell
                                className="text-[#E5E7EB] text-xs max-w-[200px] truncate"
                                title={log.message}
                              >
                                {log.message}
                              </TableCell>
                              <TableCell
                                className="text-[#E5E7EB]/60 font-mono text-[10px] max-w-[200px] truncate"
                                title={JSON.stringify(log.metadata, null, 2)}
                              >
                                {JSON.stringify(log.metadata || {})}
                              </TableCell>
                              <TableCell
                                className="text-red-400/60 font-mono text-[10px] max-w-[150px] truncate"
                                title={log.error_stack}
                              >
                                {log.error_stack || "-"}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          {/* API Tab */}
          <TabsContent value="api">
            <Card className="glass-card p-6 border-white/10">
              <h2 className="text-2xl font-bold mb-6">API Access</h2>
              <div className="space-y-6">
                <div className="p-4 bg-[#00D4FF]/10 border border-[#00D4FF]/30 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="font-semibold text-white">
                        API Documentation
                      </p>
                      <p className="text-sm text-[#E5E7EB]/70">
                        View our API documentation to integrate ZERRA into your
                        applications
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-[#00D4FF]/30 text-[#00D4FF] hover:bg-[#00D4FF]/10"
                      onClick={() => window.open("/api-docs", "_blank")}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      View Docs
                    </Button>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">API Keys</h3>
                  <p className="text-sm text-[#E5E7EB]/50">
                    Manage your API keys for programmatic access to ZERRA
                  </p>

                  {apiKeys.length === 0
                    ? (
                      <div className="p-4 bg-white/5 rounded-lg text-center">
                        <p className="text-[#E5E7EB]/70">
                          No API keys created yet
                        </p>
                      </div>
                    )
                    : (
                      <div className="space-y-2">
                        {apiKeys.map((key) => (
                          <div
                            key={key.id}
                            className="flex items-center justify-between p-4 bg-white/5 rounded-lg group"
                          >
                            <div>
                              <p className="font-medium text-white">
                                {key.name}
                              </p>
                              <div className="flex items-center gap-2">
                                <code className="text-xs bg-black/30 px-2 py-0.5 rounded text-[#E5E7EB]/70">
                                  {key.key.substring(0, 8)}...{key.key
                                    .substring(key.key.length - 4)}
                                </code>
                                <p className="text-xs text-[#E5E7EB]/30">
                                  Created {new Date(key.created_at)
                                    .toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  navigator.clipboard.writeText(key.key);
                                  toast.success("API key copied to clipboard");
                                }}
                                className="text-[#E5E7EB]/70 hover:text-white"
                              >
                                <Copy className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={async () => {
                                  if (
                                    !confirm(
                                      "Are you sure you want to delete this API key? This will break any applications using it.",
                                    )
                                  ) return;

                                  try {
                                    setSaving(true);
                                    const newKeys = apiKeys.filter((k) =>
                                      k.id !== key.id
                                    );
                                    // Save to profile metadata
                                    const { error } = await supabase
                                      .from("user_profiles")
                                      .update({
                                        metadata: {
                                          ...userProfile?.metadata,
                                          api_keys: newKeys,
                                        },
                                        updated_at: new Date().toISOString(),
                                      })
                                      .eq("id", userProfile?.id);

                                    if (error) throw error;
                                    setApiKeys(newKeys);
                                    toast.success("API key deleted");
                                  } catch (err: any) {
                                    toast.error(
                                      err.message || "Failed to delete API key",
                                    );
                                  } finally {
                                    setSaving(false);
                                  }
                                }}
                                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                  <div className="flex gap-2">
                    <Input
                      value={newApiKeyName}
                      onChange={(e) => setNewApiKeyName(e.target.value)}
                      placeholder="API key name (e.g. Production App)"
                      className="bg-white/5 border-white/20 text-white"
                      disabled={saving}
                    />
                    <Button
                      disabled={!newApiKeyName || saving}
                      onClick={async () => {
                        if (!newApiKeyName.trim()) return;

                        try {
                          setSaving(true);
                          // Generate new key
                          const newKey = {
                            id: crypto.randomUUID(),
                            name: newApiKeyName,
                            key: `sk_zerra_${
                              Math.random().toString(36).substring(2, 10)
                            }${Math.random().toString(36).substring(2, 10)}`,
                            created_at: new Date().toISOString(),
                          };

                          const newKeys = [...apiKeys, newKey];

                          // Save to profile metadata
                          const { error } = await supabase
                            .from("user_profiles")
                            .update({
                              metadata: {
                                ...userProfile?.metadata,
                                api_keys: newKeys,
                              },
                              updated_at: new Date().toISOString(),
                            })
                            .eq("id", userProfile?.id);

                          if (error) throw error;

                          setApiKeys(newKeys);
                          setNewApiKeyName("");
                          toast.success("API key created successfully");
                        } catch (err: any) {
                          console.error("Failed to create key:", err);
                          toast.error(
                            err.message || "Failed to create API key",
                          );
                        } finally {
                          setSaving(false);
                        }
                      }}
                      className="bg-gradient-to-r from-[#00D4FF] to-[#6B46C1] hover:from-[#00D4FF]/90 hover:to-[#6B46C1]/90"
                    >
                      {saving
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Plus className="w-4 h-4 mr-2" />}
                      Create Key
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Settings;
