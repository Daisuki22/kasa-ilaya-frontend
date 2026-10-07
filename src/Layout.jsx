import React, { Suspense, lazy, useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { createPageUrl } from "@/utils";
import { baseClient } from "@/api/baseClient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  Home, Package, CalendarCheck, LayoutDashboard, LogOut,
  Menu, X, User, TreePalm, Settings, QrCode, CalendarDays, Archive, SlidersHorizontal, ShieldCheck, Shield,
  Sun, Moon, Monitor, Bell, CheckCheck, MessageSquareMore,
  ChartBarIcon, CreditCard, FileText, Phone, Mail, MapPin, ArrowUpRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { FONT_STYLE_OPTIONS, useSiteSettings } from "@/hooks/useSiteSettings";
import { canAccessAdminPage } from "@/lib/adminAccess";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/lib/AuthContext";
import { handleImageFallback, LOGO_IMAGE_FALLBACK } from "@/lib/imageFallback";
import { resolveAssetUrl } from "@/lib/assetUrls";
import { toast } from "sonner";
import { RESORT_CONTACT } from "@/lib/resortContact";

const RESORT_MAP_URL = "https://www.google.com/maps?q=14.24133309901719%2C120.9992428775908";

const footerQuickLinks = [
  { label: "Home", page: "Home" },
  { label: "About Us", page: "About" },
  { label: "Rooms & Accommodations", page: "Packages" },
  { label: "Gallery", page: "About" },
  { label: "Contact Us", page: "Contact" },
];

const footerBookingLinks = [
  { label: "Book Now", page: "BookingForm" },
  { label: "My Booking", page: "MyBookings" },
  { label: "Booking Status", page: "MyBookings" },
  { label: "Payment", page: "BookingForm" },
  { label: "Payment Verification", page: "MyBookings" },
  { label: "Booking Terms", type: "terms" },
];

const safeLocalStorageGet = (key, fallback = "") => {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
};

const safeLocalStorageSet = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore storage failures; notification state is non-critical.
  }
};

const asArray = (value) => (Array.isArray(value) ? value : []);

function FooterLinkColumn({ title, links, onLegalOpen }) {
  return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-accent">{title}</h2>
      <ul className="mt-4 space-y-2.5">
        {links.map((item) => (
          item.type ? (
            <li key={`${item.label}-${item.type}`}><FooterLegalLink label={item.label} type={item.type} onOpen={onLegalOpen} /></li>
          ) : (
            <FooterRouteLink key={`${item.label}-${item.page}`} {...item} />
          )
        ))}
      </ul>
    </div>
  );
}

function FooterRouteLink({ label, page }) {
  const location = useLocation();
  const destination = createPageUrl(page);
  const onSamePage = location.pathname === destination || (page === "Home" && location.pathname === "/");

  return (
    <li>
      <Link
        to={destination}
        onClick={onSamePage ? (event) => { event.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); } : undefined}
        className="inline-flex min-h-8 items-center text-sm text-white transition-colors duration-200 hover:text-brand-accent hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        {label}
      </Link>
    </li>
  );
}

function FooterLegalLink({ label, type, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(type)}
      className="inline-flex min-h-8 items-center text-sm text-white transition-colors duration-200 hover:text-brand-accent hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
    >
      {label}
    </button>
  );
}

const Chatbot = lazy(() => import("@/components/chatbot"));

const userNav = [
  { name: "Home", icon: Home, page: "Home" },
  { name: "About", icon: Sun, page: "About" },
  { name: "Contact", icon: Bell, page: "Contact" },
  { name: "Packages", icon: Package, page: "Packages" },
  { name: "My Bookings", icon: CalendarCheck, page: "MyBookings" },
];

const adminNav = [
  { name: "Dashboard", icon: LayoutDashboard, page: "AdminDashboard" },
  { name: "Reservation Management", icon: CalendarDays, page: "AdminCalendar" },
  { name: "Package Management", icon: Package, page: "AdminPackages" },
  { name: "Reports", icon: ChartBarIcon, page: "AdminReport" },
  { name: "Inquiries", icon: MessageSquareMore, page: "AdminInquiries" },
  { name: "Payment Monitoring", icon: CreditCard, page: "AdminPaymentMonitoring" },
  { name: "Payment QR Codes", icon: QrCode, page: "AdminPaymentQRCodes" },
  { name: "User Permissions", icon: ShieldCheck, page: "AdminUserPermissions" },
  { name: "Security Settings", icon: Shield, page: "AdminSecuritySettings" },
  { name: "Legal & Privacy Settings", icon: FileText, page: "AdminLegalSettings" },
  { name: "System Settings", icon: SlidersHorizontal, page: "AdminSystemSettings" },
  { name: "Archive", icon: Archive, page: "AdminPackageArchive" },
  { name: "Activity Logs", icon: User, page: "AdminActivityLogs" },
];

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const prefersReducedMotion = useReducedMotion();
  const queryClient = useQueryClient();
  const { user, isLoadingAuth } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [footerLegalType, setFooterLegalType] = useState(null);
  const [notificationSeenAt, setNotificationSeenAt] = useState(0);
  const initializedChatNotifications = useRef(false);
  const deliveredChatNotifications = useRef(new Set());
  const chatNotificationUserKey = useRef("");
  const { settings: siteSettings } = useSiteSettings();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const isSuperAdminUser = Boolean(
    user && (user?.role === "super_admin" || user?.app_role === "super_admin" || user?._app_role === "super_admin")
  );
  const isRegularAdmin = Boolean(isAdmin && !isSuperAdminUser);
  const isAdminPage = Boolean(
    currentPageName?.startsWith("Admin") ||
    ((currentPageName === "ForgotPassword" || currentPageName === "ResetPassword") && isAdmin)
  );

  const isAdminMode = Boolean(isAdmin && isAdminPage);
  const { data: footerLegalDocuments = [], isLoading: isLoadingFooterLegal, isError: hasFooterLegalError } = useQuery({
    queryKey: ["published-legal-documents"],
    queryFn: () => baseClient.entities.LegalDocument.list("-published_at", 10),
    enabled: !isAdminMode && Boolean(footerLegalType),
  });
  const allowedAdminNav = adminNav.filter((item) => canAccessAdminPage(user, item.page));
  const guestNav = userNav.filter((item) => {
    if (item.page === "MyBookings") {
      return Boolean(user) && !isAdmin;
    }

    if (item.page === "Contact") {
      return !isAdmin;
    }

    return true;
  });
  const navItems = isAdminMode ? allowedAdminNav : guestNav;
  const profilePageTarget = isAdminMode && canAccessAdminPage(user, "AdminProfileSettings")
    ? "AdminProfileSettings"
    : "ProfileSettings";
  const siteName = siteSettings?.site_name?.trim() || "Kasa Ilaya";
  const footerLegalDocument = asArray(footerLegalDocuments).find(
    (document) => document.document_type === footerLegalType && document.status === "published"
  );

  const bodyFontFamily = FONT_STYLE_OPTIONS[siteSettings?.body_font_style]?.cssFamily || FONT_STYLE_OPTIONS.inter.cssFamily;
  const headingFontFamily = FONT_STYLE_OPTIONS[siteSettings?.heading_font_style]?.cssFamily || FONT_STYLE_OPTIONS.playfair.cssFamily;

  useEffect(() => {
    document.documentElement.style.setProperty("--font-body", bodyFontFamily);
    document.documentElement.style.setProperty("--font-heading", headingFontFamily);
  }, [bodyFontFamily, headingFontFamily]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
      }
    };

    if (mobileOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileOpen]);

  useEffect(() => {
    if (!user) {
      setNotificationSeenAt(0);
      return;
    }

    const key = `ki-notifications-seen-at:${user.id || user.email}`;
    const stored = Number(safeLocalStorageGet(key, "0"));
    setNotificationSeenAt(Number.isFinite(stored) ? stored : 0);
  }, [user]);

  const { data: persistedNotifications = [] } = useQuery({
    queryKey: ["user-notifications", user?.email],
    queryFn: () => baseClient.entities.Notification.list("-created_date", 100),
    enabled: Boolean(user?.email),
    refetchInterval: 30000,
  });

  const { data: persistedUnreadCount = { count: 0 } } = useQuery({
    queryKey: ["user-notification-unread-count", user?.email],
    queryFn: () => baseClient.entities.Notification.unreadCount(),
    enabled: Boolean(user?.email),
    refetchInterval: 30000,
  });

  const { data: notificationInquiries = [] } = useQuery({
    queryKey: ["user-notification-inquiries", user?.id, user?.email, isAdmin],
    queryFn: () => (isAdmin ? baseClient.inquiries.list() : baseClient.inquiries.mine([])),
    enabled: Boolean(user),
    refetchInterval: 15000,
  });

  const accountNotifications = [];
  if (user?.disabled) {
    accountNotifications.push({
      id: "account-disabled",
      title: "Account access restricted",
      description: "Your account is currently disabled. Please contact resort admin support.",
      createdAt: user?.updated_date || user?.created_date || new Date().toISOString(),
      link: createPageUrl("ProfileSettings"),
    });
  }

  const persistedNotificationItems = asArray(persistedNotifications).map((item) => {
    const storedLink = String(item.link || "");
    const legacyBookingLink = /^\/?AdminBookings(?:[/?#]|$)/i.test(storedLink);
    const isAdminBookingNotification = isAdmin && (
      String(item.entity_type || "").toLowerCase() === "booking" || legacyBookingLink
    );
    const storedBookingId = item.entity_id || new URLSearchParams(storedLink.split("?")[1] || "").get("bookingId");
    const bookingLink = `${createPageUrl("AdminCalendar")}${storedBookingId ? `?bookingId=${encodeURIComponent(storedBookingId)}` : ""}`;

    return {
      ...item,
      id: `persisted-${item.id}`,
      createdAt: item.created_date,
      isPersistent: true,
      link: isAdminBookingNotification
        ? bookingLink
        : storedLink
          ? createPageUrl(storedLink.replace(/^\//, ""))
          : createPageUrl("MyBookings"),
    };
  });

  const chatNotifications = asArray(notificationInquiries)
    .filter((inquiry) => isAdmin ? inquiry.last_sender_type === "guest" : inquiry.last_sender_type === "admin")
    .map((inquiry) => ({
      id: `inquiry-message-${inquiry.id}-${inquiry.last_message_at || inquiry.updated_date || ""}`,
      title: isAdmin
        ? `New message from ${inquiry.last_sender_name || inquiry.guest_name || "guest"}`
        : "New reply from Kasa Ilaya",
      description: inquiry.last_message_preview || `Update on: ${inquiry.subject || "your inquiry"}`,
      createdAt: inquiry.last_message_at || inquiry.updated_date || inquiry.created_date || new Date().toISOString(),
      link: createPageUrl(isAdmin ? "AdminInquiries" : "Contact"),
    }));

  const notifications = [...persistedNotificationItems, ...accountNotifications, ...chatNotifications]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 12);

  const unreadCount = Number(persistedUnreadCount.count || 0) + notifications.filter((item) => !item.isPersistent && new Date(item.createdAt).getTime() > notificationSeenAt).length;

  const markNotificationsAsRead = async () => {
    if (!user) {
      return;
    }

    const seenAt = Date.now();
    const key = `ki-notifications-seen-at:${user.id || user.email}`;
    safeLocalStorageSet(key, String(seenAt));
    setNotificationSeenAt(seenAt);
    try {
      await baseClient.entities.Notification.markAllRead();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["user-notifications", user.email] }),
        queryClient.invalidateQueries({ queryKey: ["user-notification-unread-count", user.email] }),
      ]);
    } catch (error) {
      toast.error(error?.message || "Unable to update notifications.");
    }
  };

  useEffect(() => {
    if (!user) {
      initializedChatNotifications.current = false;
      deliveredChatNotifications.current.clear();
      chatNotificationUserKey.current = "";
      return;
    }

    const userKey = String(user.id || user.email || "");
    if (chatNotificationUserKey.current !== userKey) {
      initializedChatNotifications.current = false;
      deliveredChatNotifications.current.clear();
      chatNotificationUserKey.current = userKey;
    }

    if (!initializedChatNotifications.current) {
      chatNotifications.forEach((notification) => deliveredChatNotifications.current.add(notification.id));
      initializedChatNotifications.current = true;
      return;
    }

    chatNotifications.forEach((notification) => {
      if (deliveredChatNotifications.current.has(notification.id)) {
        return;
      }

      deliveredChatNotifications.current.add(notification.id);
      if (document.visibilityState === "visible" || !("Notification" in window) || Notification.permission !== "granted") {
        return;
      }

      const browserNotification = new Notification(notification.title, {
        body: notification.description,
        icon: "/favicon-32.png",
        tag: notification.id,
      });
      browserNotification.onclick = () => {
        window.focus();
        window.location.assign(notification.link);
        browserNotification.close();
      };
    });
  }, [chatNotifications, user]);

  const enableBrowserNotifications = () => {
    if (!("Notification" in window) || Notification.permission !== "default") {
      return;
    }

    void Notification.requestPermission();
  };

  const notificationSubtitle = isSuperAdminUser
    ? "Bookings, chat messages, audit logs, archive actions, and system events"
    : isRegularAdmin
      ? "Booking and guest chat updates"
      : "Account, booking, and chat updates";

  const renderNotificationMenu = ({ compact = false } = {}) => {
    if (!user) {
      return null;
    }

    return (
      <DropdownMenu
        open={notificationOpen}
        onOpenChange={(open) => {
          setNotificationOpen(open);
          if (open) {
            markNotificationsAsRead();
          }
        }}
      >
        <DropdownMenuTrigger asChild>
          {compact ? (
            <Button variant="outline" size="icon" className="relative h-8 w-8" aria-label="Notifications" onClick={enableBrowserNotifications}>
              <Bell className="h-3.5 w-3.5" />
              {unreadCount > 0 ? (
                <span className="absolute -right-1 -top-1 min-w-[1rem] rounded-full bg-destructive px-1 text-[9px] font-semibold leading-3.5 text-destructive-foreground">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              ) : null}
            </Button>
          ) : (
            <Button variant="ghost" size="icon" className="relative h-7 w-7" aria-label="Notifications" onClick={enableBrowserNotifications}>
              <Bell className="h-3 w-3" />
              {unreadCount > 0 ? (
                <span className="absolute -right-1 -top-1 min-w-[1rem] rounded-full bg-destructive px-1 text-[9px] font-semibold leading-3.5 text-destructive-foreground">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              ) : null}
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[min(92vw,28rem)] p-0">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <div>
              <p className="text-sm font-semibold text-foreground">Notifications</p>
              <p className="text-xs text-muted-foreground">{notificationSubtitle}</p>
            </div>
            <Button variant="ghost" size="sm" className="h-8 gap-1 px-2 text-xs" onClick={markNotificationsAsRead}>
              <CheckCheck className="h-3.5 w-3.5" /> Mark all as read
            </Button>
          </div>

          <div className="max-h-[24rem] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">No notifications yet.</div>
            ) : (
              notifications.map((item) => {
                const eventTime = new Date(item.createdAt);
                const isUnread = item.isPersistent ? !item.is_read : eventTime.getTime() > notificationSeenAt;
                return (
                  <DropdownMenuItem key={item.id} asChild>
                    <Link
                      to={item.link || createPageUrl("MyBookings")}
                      className={`flex flex-col items-start gap-1 border-b border-border/60 px-3 py-3 ${isUnread ? "bg-primary/5" : ""}`}
                    >
                      <div className="flex w-full items-center justify-between gap-2">
                        <span className="text-sm font-medium text-foreground">{item.title}</span>
                        {isUnread ? <span className="h-2 w-2 rounded-full bg-primary" /> : null}
                      </div>
                      <span className="text-xs text-muted-foreground">{item.description}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {Number.isNaN(eventTime.getTime())
                          ? "Just now"
                          : `${formatDistanceToNow(eventTime, { addSuffix: true })}`}
                      </span>
                    </Link>
                  </DropdownMenuItem>
                );
              })
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const themeOptions = [
    { id: "light", Icon: Sun, label: "Light" },
    { id: "system", Icon: Monitor, label: "System" },
    { id: "dark", Icon: Moon, label: "Dark" },
  ];
  const activeTheme = themeOptions.find((option) => option.id === theme) || themeOptions[1];
  const ActiveThemeIcon = activeTheme.Icon;
  const resolvedThemeLabel = resolvedTheme === "dark" ? "Dark" : "Light";
  const themeModeLabel = theme === "system"
    ? `System (${resolvedThemeLabel})`
    : `${activeTheme.label} mode`;

  const ThemeModeIndicator = ({ compact = false } = {}) => (
    <div className={`flex flex-nowrap items-center gap-1 rounded-lg border border-border bg-background/70 text-muted-foreground ${compact ? "px-2 py-1.5 text-xs" : "px-2 py-2 text-xs"}`}>
      <ActiveThemeIcon className={`${compact ? "h-3.5 w-3.5" : "h-4 w-4"} shrink-0`} />
      <span className="shrink-0 whitespace-nowrap font-semibold text-foreground">{compact ? activeTheme.label : "Appearance"}</span>
      <span className="shrink-0 whitespace-nowrap text-muted-foreground">{compact ? (theme === "system" ? resolvedThemeLabel : "mode") : themeModeLabel}</span>
    </div>
  );

  const ThemeToggle = () => (
    <div className="px-2 py-1.5">
      <ThemeModeIndicator />
      <div className="mt-2 flex items-center overflow-hidden rounded-lg border border-border">
        {themeOptions.map(({ id, Icon, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTheme(id)}
            title={label}
            aria-label={label}
            className={`flex flex-1 items-center justify-center px-2.5 py-1.5 text-xs font-medium transition-colors ${
              theme === id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        ))}
      </div>
    </div>
  );

  const NavbarThemeToggle = () => (
    <div className="hidden items-center gap-2 sm:flex">
      <ThemeModeIndicator compact />
      <div className="flex items-center rounded-lg border border-border bg-background/70 p-1">
        {themeOptions.map(({ id, Icon, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTheme(id)}
            title={label}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
              theme === id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
            aria-label={label}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        ))}
      </div>
    </div>
  );

  const handleLogout = () => {
    setMobileOpen(false);
    setNotificationOpen(false);
    void baseClient.auth.logout("/");
  };

  const renderUserMenu = () => {
    if (user) {
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full p-0" aria-label="Open user menu">
              <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-primary/10">
                {user.profile_image_url ? (
                  <img src={resolveAssetUrl(user.profile_image_url)} alt={user.full_name || "Profile"} loading="lazy" decoding="async" onError={(event) => handleImageFallback(event, LOGO_IMAGE_FALLBACK)} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xs font-semibold text-primary">
                    {user.full_name?.[0]?.toUpperCase() || "U"}
                  </span>
                )}
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5 text-sm text-muted-foreground">{user.email}</div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to={createPageUrl(profilePageTarget)}>
                <Settings className="mr-2 h-4 w-4" />
                Profile Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }

    return (
      <Button size="sm" onClick={() => baseClient.auth.redirectToLogin(window.location.href)}>
        Sign In
      </Button>
    );
  };

  const logoUrl = resolveAssetUrl(siteSettings?.logo_url || "");
  const renderBrandMark = (compact = false) => (
    <div className="flex min-w-0 items-center gap-3">
      <div className={`${compact ? "hidden sm:flex" : "flex"} h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/10 sm:h-16 sm:w-16`}>
        {logoUrl ? (
          <img src={logoUrl} alt={`${siteName} logo`} loading="eager" decoding="async" onError={(event) => handleImageFallback(event, LOGO_IMAGE_FALLBACK)} className="h-full w-full object-contain" />
        ) : (
          <TreePalm className="h-6 w-6 text-primary" />
        )}
      </div>
      {!compact ? (
        <div>
          <span className="block font-display text-lg font-bold text-foreground tracking-tight">
            {siteName}
          </span>
          <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            {isAdminMode ? "Resort Admin" : "Resort Navigation"}
          </span>
        </div>
      ) : (
        <div className="min-w-0">
          <span className="block max-w-[11rem] truncate font-display text-sm font-bold tracking-tight text-foreground sm:max-w-none sm:text-lg">
            {siteName} Resort
          </span>
          <span className="block truncate text-[9px] uppercase tracking-[0.14em] text-muted-foreground sm:text-xs sm:tracking-[0.2em]">
            Official Resort Website
          </span>
        </div>
      )}
    </div>
  );

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex h-full w-full items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-primary border-border" />
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-background ${isAdminMode ? "md:pl-60" : ""}`}>
      {isAdminMode ? (
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 border-r border-border/80 bg-gradient-to-b from-card via-card to-primary/[0.04] shadow-[8px_0_36px_-32px_rgba(15,61,47,0.4)] md:flex md:flex-col">
        <div className="border-b border-border/70 px-6 py-6">
          <Link to={createPageUrl("Home")} className="flex items-center gap-3">
            {renderBrandMark()}
          </Link>
        </div>

        <div className="flex flex-1 flex-col overflow-y-auto px-4 py-6">
          <nav className="space-y-1.5">
            <p className="mb-2 px-3 text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Admin workspace</p>
            {navItems.map((item) => (
              <Link
                key={item.page || item.href}
                to={item.href || createPageUrl(item.page)}
                className={`group relative isolate flex items-center gap-2.5 rounded-xl border px-2.5 py-2.5 text-xs font-medium transition-all duration-200 ${
                  currentPageName === item.page
                    ? "border-primary/15 text-primary-foreground shadow-md shadow-primary/15"
                    : "border-transparent text-muted-foreground hover:border-border/70 hover:bg-background/80 hover:text-foreground hover:shadow-sm"
                }`}
              >
                {currentPageName === item.page ? (
                  <motion.span
                    layoutId="admin-sidebar-active"
                    className="absolute inset-0 z-0 rounded-xl bg-primary"
                    transition={{ type: "spring", stiffness: 380, damping: 34 }}
                  />
                ) : null}
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors ${currentPageName === item.page ? "bg-white/15" : "bg-muted/70 group-hover:bg-primary/10"}`}>
                  <item.icon className="relative z-10 h-3.5 w-3.5" />
                </span>
                <span className="relative z-10">{item.name}</span>
              </Link>
            ))}
          </nav>
        </div>

        <div className="space-y-3 border-t border-border/70 bg-background/40 px-4 py-4">
          {user ? (
            <>
              {/* User info */}
              <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-card/80 p-3 shadow-sm">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10">
                  {user.profile_image_url ? (
                    <img src={resolveAssetUrl(user.profile_image_url)} alt={user.full_name || "Profile"} loading="lazy" decoding="async" onError={(event) => handleImageFallback(event, LOGO_IMAGE_FALLBACK)} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-sm font-semibold text-primary">
                      {user.full_name?.[0]?.toUpperCase() || "U"}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{user.full_name}</p>
                  <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                </div>
              </div>

              {/* Theme toggle */}
              <ThemeToggle />

              {/* Profile Settings */}
              <Link
                to={createPageUrl(profilePageTarget)}
                className="flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Settings className="h-4 w-4" />
                Profile Settings
              </Link>

              {/* Logout */}
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </>
          ) : (
            <Button className="w-full" onClick={() => baseClient.auth.redirectToLogin(window.location.href)}>
              Sign In
            </Button>
          )}
        </div>
      </aside>
      ) : null}

      <div className="min-h-screen">
        {isAdminMode && user ? (
          <div className="fixed right-3 top-3 z-50 hidden items-center gap-2 md:flex lg:right-4 lg:top-4">
            {renderNotificationMenu({ compact: true })}
          </div>
        ) : null}

        <header className={`fixed inset-x-0 top-0 z-50 border-b border-border bg-card/95 shadow-sm backdrop-blur-xl supports-[backdrop-filter]:bg-card/80 ${isAdminMode ? "md:hidden" : ""}`}>
          <div className={`min-h-16 px-2 sm:px-3 lg:px-4 ${isAdminMode ? "flex items-center justify-between" : "flex items-center justify-between py-3 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:items-center lg:gap-6 xl:gap-10"}`}>
            <Link to={createPageUrl("Home")} className="flex min-w-0 items-center gap-3">
              {renderBrandMark(true)}
            </Link>

            {!isAdminMode ? (
              <nav className="hidden items-center justify-center gap-1 rounded-full border border-border/70 bg-background/75 p-1.5 shadow-[0_8px_28px_-20px_rgba(15,61,47,0.45)] backdrop-blur lg:flex lg:justify-self-center xl:gap-1.5 xl:p-2">
                {navItems.map((item) => (
                  <Link
                    key={item.page || item.href}
                    to={item.href || createPageUrl(item.page)}
                    className={`relative isolate flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition-all duration-200 xl:gap-2.5 xl:px-4 xl:py-2.5 ${
                      currentPageName === item.page
                        ? "text-primary-foreground"
                        : "text-muted-foreground hover:bg-primary/5 hover:text-primary"
                    }`}
                  >
                    {currentPageName === item.page ? (
                      <motion.span
                        layoutId="user-navbar-active"
                        className="absolute inset-0 z-0 rounded-full bg-primary shadow-md shadow-primary/20"
                        transition={{ type: "spring", stiffness: 380, damping: 34 }}
                      />
                    ) : null}
                    <item.icon className={`relative z-10 h-4 w-4 ${currentPageName === item.page ? "text-secondary" : ""}`} />
                    <span className="relative z-10">{item.name}</span>
                  </Link>
                ))}
              </nav>
            ) : null}

            <div className={`flex items-center gap-2 sm:gap-3 ${isAdminMode ? "" : "lg:justify-self-end"}`}>
              <NavbarThemeToggle />
              {!isAdminMode ? renderNotificationMenu({ compact: true }) : null}
              <div className="hidden sm:block">
                {renderUserMenu()}
              </div>

              <Button
                variant="ghost"
                size="icon"
                className={isAdminMode ? "rounded-xl border border-border/70 bg-background/80 shadow-sm" : "rounded-xl border border-border/70 bg-background/80 text-foreground shadow-sm lg:hidden"}
                onClick={() => setMobileOpen(!mobileOpen)}
                aria-expanded={mobileOpen}
                aria-controls="mobile-navigation-drawer"
                aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
              >
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </div>
          </div>
        </header>

        <div
          className={`fixed inset-0 z-[55] bg-black/45 transition-opacity duration-300 ${
            isAdminMode ? "md:hidden" : "lg:hidden"
          } ${mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />

        <aside
          id="mobile-navigation-drawer"
          className={`fixed right-0 top-0 z-[60] flex h-dvh w-[min(82vw,22rem)] flex-col border-l border-border bg-card shadow-2xl transition-transform duration-300 ease-out ${
            isAdminMode ? "md:hidden" : "lg:hidden"
          } ${mobileOpen ? "translate-x-0" : "translate-x-full"}`}
          aria-hidden={!mobileOpen}
        >
          <div className="flex min-h-16 items-center justify-between border-b border-border px-4">
            <Link to={createPageUrl("Home")} onClick={() => setMobileOpen(false)} className="min-w-0">
              {renderBrandMark(true)}
            </Link>
            <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)} aria-label="Close navigation menu">
              <X className="h-5 w-5" />
            </Button>
          </div>

          <nav className="flex-1 overflow-y-auto px-4 py-5">
            <p className="mb-2 px-3 text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{isAdminMode ? "Admin workspace" : "Explore Kasa Ilaya"}</p>
            <div className="space-y-1.5">
              {navItems.map((item) => (
                <Link
                  key={item.page || item.href}
                  to={item.href || createPageUrl(item.page)}
                  onClick={() => setMobileOpen(false)}
                  className={`relative isolate flex items-center gap-3 rounded-xl border px-3 py-3 text-sm font-semibold transition-all duration-200 ${
                    currentPageName === item.page
                      ? "border-primary/15 text-primary-foreground shadow-md shadow-primary/15"
                      : "border-transparent text-muted-foreground hover:border-border/70 hover:bg-muted/70 hover:text-foreground"
                  }`}
                >
                  {currentPageName === item.page ? (
                    <motion.span
                      layoutId={isAdminMode ? "admin-mobile-active" : "user-mobile-active"}
                      className="absolute inset-0 z-0 rounded-xl bg-primary"
                      transition={{ type: "spring", stiffness: 380, damping: 34 }}
                    />
                  ) : null}
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${currentPageName === item.page ? "bg-white/15" : "bg-muted/80"}`}>
                    <item.icon className="relative z-10 h-4 w-4" />
                  </span>
                  <span className="relative z-10">{item.name}</span>
                </Link>
              ))}
            </div>
          </nav>

          <div className="space-y-3 border-t border-border px-4 py-4">
            <ThemeToggle />
            {user ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 rounded-lg border border-border bg-background/70 p-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10">
                    {user.profile_image_url ? (
                      <img src={resolveAssetUrl(user.profile_image_url)} alt={user.full_name || "Profile"} loading="lazy" decoding="async" onError={(event) => handleImageFallback(event, LOGO_IMAGE_FALLBACK)} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-sm font-semibold text-primary">
                        {user.full_name?.[0]?.toUpperCase() || "U"}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{user.full_name || "Account"}</p>
                    <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </div>

                <Link
                  to={createPageUrl(profilePageTarget)}
                  onClick={() => setMobileOpen(false)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Settings className="h-4 w-4" />
                  Profile Settings
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    handleLogout();
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </div>
            ) : (
              <Button className="w-full" onClick={() => baseClient.auth.redirectToLogin(window.location.href)}>
                Sign In
              </Button>
            )}
          </div>
        </aside>

        <main className={`min-h-screen ${isAdminMode ? "pt-16 md:pt-0" : "pt-16"}`}>
          <motion.div
            key={location.pathname}
            initial={prefersReducedMotion ? false : { opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.28, ease: "easeOut" }}
          >
            {children}
          </motion.div>
        </main>

        {!isAdminMode ? (
          <>
            <footer id="site-footer" className="border-t border-white/10 bg-[var(--brand-deep-teal)] text-white">
              <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="grid gap-8 border-b border-white/15 py-9 sm:py-11 md:grid-cols-[minmax(0,1.4fr)_auto] md:items-center md:gap-10">
                  <div className="flex items-start gap-4">
                    <Link to={createPageUrl("Home")} aria-label={`${siteName} home`} className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-white/10 p-2 sm:h-20 sm:w-20">
                      {siteSettings?.logo_url ? (
                        <img src={resolveAssetUrl(siteSettings.logo_url)} alt={`${siteName} logo`} loading="lazy" decoding="async" onError={(event) => handleImageFallback(event, LOGO_IMAGE_FALLBACK)} className="h-full w-full object-contain" />
                      ) : (
                        <TreePalm className="h-8 w-8 text-brand-accent" aria-hidden="true" />
                      )}
                    </Link>
                    <div className="min-w-0 max-w-xl">
                      <p className="font-display text-xl font-bold tracking-tight sm:text-2xl">{siteName} Resort</p>
                      <p className="mt-2 text-sm leading-6 text-white">
                        Kasa Ilaya Resort &amp; Event Place — your destination for relaxing stays, celebrations, and unforgettable moments.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-start gap-3 md:items-end">
                    <p className="text-sm text-white">Ready to plan your visit?</p>
                    <Button asChild className="min-h-11 gap-2 bg-brand-accent px-5 font-semibold text-brand-charcoal shadow-sm transition duration-200 hover:-translate-y-0.5 hover:brightness-95 hover:shadow-md focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--brand-deep-teal)]">
                      <Link to={createPageUrl("BookingForm")}>
                        <CalendarCheck className="h-4 w-4" aria-hidden="true" />
                        Book Now
                        <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    </Button>
                  </div>
                </div>

                <nav aria-label="Footer navigation" className="grid grid-cols-2 gap-x-5 gap-y-8 py-9 sm:gap-x-8 md:grid-cols-4 md:py-10">
                  <FooterLinkColumn title="Quick Links" links={footerQuickLinks} />
                  <FooterLinkColumn title="Booking" links={footerBookingLinks} onLegalOpen={setFooterLegalType} />
                  <div>
                    <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-accent">Information</h2>
                    <ul className="mt-4 space-y-2.5">
                      <FooterRouteLink label="About Kasa Ilaya" page="About" />
                      <FooterRouteLink label="FAQs & Guest Help" page="Contact" />
                      <li><FooterLegalLink label="Privacy Policy" type="privacy" onOpen={setFooterLegalType} /></li>
                      <li><FooterLegalLink label="Terms & Conditions" type="terms" onOpen={setFooterLegalType} /></li>
                      <li><FooterLegalLink label="Cancellation Policy" type="terms" onOpen={setFooterLegalType} /></li>
                    </ul>
                  </div>
                  <div>
                    <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-accent">Contact</h2>
                    <ul className="mt-4 space-y-3 text-sm">
                      <li>
                        <a href={`tel:${RESORT_CONTACT.phoneLink}`} className="group flex min-h-8 items-center gap-2.5 text-white transition-colors hover:text-brand-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
                          <Phone className="h-4 w-4 shrink-0 text-brand-accent" aria-hidden="true" />
                          <span>{RESORT_CONTACT.phoneDisplay}</span>
                        </a>
                      </li>
                      <li>
                        <a href={`mailto:${RESORT_CONTACT.email}`} className="group flex min-h-8 items-center gap-2.5 text-white transition-colors hover:text-brand-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
                          <Mail className="h-4 w-4 shrink-0 text-brand-accent" aria-hidden="true" />
                          <span>{RESORT_CONTACT.email}</span>
                        </a>
                      </li>
                      <li>
                        <a href={RESORT_MAP_URL} target="_blank" rel="noreferrer" className="group flex min-h-8 items-start gap-2.5 text-white transition-colors hover:text-brand-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
                          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-accent" aria-hidden="true" />
                          <span>{RESORT_CONTACT.address}</span>
                          <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-accent" aria-hidden="true" />
                        </a>
                      </li>
                    </ul>
                  </div>
                </nav>

                <div className="flex flex-col gap-3 border-t border-white/15 py-5 text-xs text-white sm:flex-row sm:items-center sm:justify-between lg:pr-64">
                  <p>© {new Date().getFullYear()} Kasa Ilaya Resort. All rights reserved.</p>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                    <FooterLegalLink label="Privacy Policy" type="privacy" onOpen={setFooterLegalType} />
                    <FooterLegalLink label="Terms & Conditions" type="terms" onOpen={setFooterLegalType} />
                  </div>
                </div>
              </div>
            </footer>

            <Dialog open={Boolean(footerLegalType)} onOpenChange={(open) => { if (!open) setFooterLegalType(null); }}>
              <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
                <DialogHeader className="border-b border-border px-6 py-5 pr-12 text-left">
                  <DialogTitle className="font-display text-2xl text-foreground">{footerLegalDocument?.title || (footerLegalType === "terms" ? "Terms & Conditions" : "Privacy Policy")}</DialogTitle>
                  <DialogDescription className="mt-2 text-sm leading-6 text-muted-foreground">
                    {isLoadingFooterLegal ? "Loading the published document…" : footerLegalDocument ? `Published version ${footerLegalDocument.version}.` : hasFooterLegalError ? "Unable to load the published document." : "The resort has not published this document yet."}
                  </DialogDescription>
                </DialogHeader>
                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                  <div className="whitespace-pre-wrap break-words text-sm leading-7 text-foreground">
                    {isLoadingFooterLegal ? "Loading document…" : footerLegalDocument?.content || (hasFooterLegalError ? "Please try again later or contact Kasa Ilaya Resort for help." : "For help with resort policies, please contact Kasa Ilaya Resort.")}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </>
        ) : null}
      </div>

      {/* Chatbot */}
      {!isAdminMode ? (
        <Suspense fallback={null}>
          <Chatbot />
        </Suspense>
      ) : null}
    </div>
  );
}
