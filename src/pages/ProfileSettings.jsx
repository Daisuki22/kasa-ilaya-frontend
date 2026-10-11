import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { baseClient } from '@/api/baseClient';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { resolveAssetUrl } from '@/lib/assetUrls';
import { optimizeImageFile } from '@/lib/optimizeImageFile';
import {
  Activity, Clock3, KeyRound, Laptop, Loader2,
  LockKeyhole, LogOut, MonitorSmartphone, ShieldCheck, ShieldQuestion,
  Upload, UserRound, Bell, Eye, Database, RefreshCw,
} from 'lucide-react';
import PasswordInput, { passwordMeetsRequirements } from '@/components/auth/PasswordInput';

const dateInput = (value) => (value ? String(value).slice(0, 10) : '');
const dateLabel = (value, fallback = 'Not available') => {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};
const localToday = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
};
const describeDevice = (agent = '') => {
  const ua = String(agent);
  const browser = /Edg\//.test(ua) ? 'Microsoft Edge' : /OPR\//.test(ua) ? 'Opera' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /FxiOS|Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  const device = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android device' : /Mobile/.test(ua) ? 'Mobile device' : 'Computer';
  return { browser, os, device };
};

export default function ProfileSettings({ legacySpacing = false }) {
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({ full_name: '', phone: '', birth_date: '', profile_image_url: '' });
  const [password, setPassword] = useState({ current_password: '', new_password: '', confirmPassword: '' });
  const [sessions, setSessions] = useState([]);
  const [activity, setActivity] = useState([]);
  const [activityPage, setActivityPage] = useState(1);
  const [activityHasMore, setActivityHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [busy, setBusy] = useState('');
  const [profileImageUnavailable, setProfileImageUnavailable] = useState(false);
  const photoInputRef = useRef(null);

  const syncUser = (current) => {
    setUser(current);
    setProfileImageUnavailable(false);
    setForm({
      full_name: current.full_name || '',
      phone: current.phone || '',
      birth_date: dateInput(current.birth_date),
      profile_image_url: current.profile_image_url || '',
    });
  };

  const loadSessions = useCallback(async () => {
    setLoadingSessions(true);
    try { setSessions(await baseClient.auth.accountSessions()); }
    catch (error) { toast.error(error.message || 'Unable to load signed-in devices.'); }
    finally { setLoadingSessions(false); }
  }, []);

  const loadActivity = useCallback(async (page = 1, append = false) => {
    setLoadingActivity(true);
    try {
      const result = await baseClient.auth.accountActivity(page);
      setActivity((current) => append ? [...current, ...result.items] : result.items);
      setActivityPage(result.page);
      setActivityHasMore(result.has_more);
    } catch (error) { toast.error(error.message || 'Unable to load account activity.'); }
    finally { setLoadingActivity(false); }
  }, []);

  useEffect(() => {
    let active = true;
    baseClient.auth.me()
      .then((current) => { if (active) syncUser(current); })
      .catch(() => { if (active) baseClient.auth.redirectToLogin(window.location.href); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!user) return;
    void loadSessions();
    void loadActivity(1);
  }, [user?.id, loadSessions, loadActivity]);

  const saveProfile = async (event) => {
    event.preventDefault();
    setSavingProfile(true);
    try {
      syncUser(await baseClient.auth.updateMe({ full_name: form.full_name, phone: form.phone, birth_date: form.birth_date, profile_image_url: form.profile_image_url }));
      toast.success('Account information saved.');
    } catch (error) { toast.error(error.message || 'Unable to update account information.'); }
    finally { setSavingProfile(false); }
  };

  const uploadPhoto = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy('photo');
    try {
      const optimized = await optimizeImageFile(file, 800);
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(optimized.type)) {
        throw new Error('Choose a JPG, PNG, or WebP photo.');
      }
      if (optimized.size > 5 * 1024 * 1024) {
        throw new Error('Profile photo must be 5 MB or smaller.');
      }
      const uploaded = await baseClient.integrations.Core.UploadFile({ file: optimized, purpose: 'profile_image' });
      syncUser(await baseClient.auth.updateMe({ profile_image_url: uploaded.file_url }));
      toast.success('Profile photo updated.');
    } catch (error) { toast.error(error.message || 'Unable to upload profile photo.'); }
    finally { setBusy(''); event.target.value = ''; }
  };

  const removePhoto = async () => {
    setBusy('photo');
    try { syncUser(await baseClient.auth.updateMe({ profile_image_url: '' })); toast.success('Profile photo removed.'); }
    catch (error) { toast.error(error.message || 'Unable to remove profile photo.'); }
    finally { setBusy(''); }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    if (password.new_password !== password.confirmPassword) { toast.error('New passwords do not match.'); return; }
    if (!passwordMeetsRequirements(password.new_password)) { toast.error('Use at least 10 characters with uppercase, lowercase, a number, and a special character.'); return; }
    setSavingPassword(true);
    try {
      await baseClient.auth.changePassword({ current_password: password.current_password, new_password: password.new_password });
      setPassword({ current_password: '', new_password: '', confirmPassword: '' });
      toast.success('Password changed. Other devices were signed out.');
      await Promise.all([loadSessions(), loadActivity(1)]);
    } catch (error) { toast.error(error.message || 'Unable to change password.'); }
    finally { setSavingPassword(false); }
  };

  const revokeSession = async (session) => {
    const device = describeDevice(session.user_agent);
    if (!window.confirm(`Sign out ${device.device} (${device.browser})? That device will need to sign in again.`)) return;
    setBusy(session.id);
    try {
      await baseClient.auth.revokeSession(session.id);
      toast.success('Device signed out.');
      await Promise.all([loadSessions(), loadActivity(1)]);
    } catch (error) { toast.error(error.message || 'Unable to sign out that device.'); }
    finally { setBusy(''); }
  };

  const revokeOthers = async () => {
    if (!window.confirm('Sign out all other devices? This device will stay signed in.')) return;
    setBusy('others');
    try {
      const result = await baseClient.auth.revokeOtherSessions();
      toast.success(`${result.revoked_count} other device${result.revoked_count === 1 ? '' : 's'} signed out.`);
      await Promise.all([loadSessions(), loadActivity(1)]);
    } catch (error) { toast.error(error.message || 'Unable to sign out other devices.'); }
    finally { setBusy(''); }
  };

  if (loading) return <div className="px-4 py-10 text-sm text-muted-foreground">Loading account settings…</div>;
  if (!user) return null;

  const verified = Boolean(user.is_verified);
  const tabs = [
    ['overview', UserRound, 'Overview'], ['review', ShieldCheck, 'Account review'],
    ['security', KeyRound, 'Login & security'], ['sessions', MonitorSmartphone, 'Devices'],
    ['activity', Activity, 'Activity'], ['preferences', Bell, 'Preferences'], ['privacy', Eye, 'Privacy'],
  ];

  return (
    <main className={`w-full min-w-0 ${legacySpacing ? 'max-w-none' : 'app-content-container'} px-2 py-6 sm:px-3 lg:px-4`}>
      <header className="mb-6">
        <p className="text-sm font-medium text-primary">Your account</p>
        <h1 className="mt-1 font-display text-3xl font-bold text-foreground">Account Settings</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">Manage your resort account, sign-in security, and devices.</p>
      </header>

      <Tabs defaultValue="overview" className="min-w-0 space-y-5">
        <TabsList className="flex h-auto w-full flex-nowrap justify-start gap-1 overflow-x-auto overflow-y-hidden overscroll-x-contain rounded-xl border border-border bg-card p-1.5">
          {tabs.map(([value, Icon, label]) => <TabsTrigger key={value} value={value} className="shrink-0 gap-2 whitespace-nowrap px-3 py-2.5"><Icon className="h-4 w-4 shrink-0" /><span className="whitespace-nowrap">{label}</span></TabsTrigger>)}
        </TabsList>

        <TabsContent value="overview" className="min-w-0 space-y-5">
          <Card>
            <CardContent className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border border-border bg-primary/10">
                {form.profile_image_url && !profileImageUnavailable ? <img src={resolveAssetUrl(form.profile_image_url)} alt={`${form.full_name || 'Account'} profile`} onError={() => setProfileImageUnavailable(true)} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-2xl font-semibold text-primary">{form.full_name?.[0]?.toUpperCase() || 'U'}</div>}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-xl font-semibold">{form.full_name || 'Unnamed account'}</h2>
                <p className="break-all text-sm text-muted-foreground">{user.email}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant={verified ? 'default' : 'secondary'}>{verified ? 'Email verified' : 'Email pending verification'}</Badge>
                  <Badge variant="outline" className="capitalize">{(user.role || 'guest').replace(/_/g, ' ')}</Badge>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => photoInputRef.current?.click()} disabled={busy === 'photo'}>
                  {busy === 'photo' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {busy === 'photo' ? 'Saving…' : 'Change photo'}
                </Button>
                <input ref={photoInputRef} type="file" accept="image/*" aria-label="Choose a profile photo" className="sr-only" onChange={uploadPhoto} disabled={busy === 'photo'} />
                {form.profile_image_url ? <Button variant="outline" onClick={removePhoto} disabled={busy === 'photo'}>Remove</Button> : null}
              </div>
            </CardContent>
          </Card>
          <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,.8fr)]">
            <Card className="min-w-0">
              <CardHeader><CardTitle>Personal information</CardTitle><CardDescription>Update the details used for your resort account.</CardDescription></CardHeader>
              <CardContent className="min-w-0">
                <form className="grid min-w-0 gap-4 sm:grid-cols-2" onSubmit={saveProfile}>
                  <div className="min-w-0 space-y-2 sm:col-span-2"><Label htmlFor="account-email">Sign-in email</Label><Input id="account-email" type="email" value={user.email || ''} readOnly aria-describedby="email-help" /><p id="email-help" className="text-xs text-muted-foreground">Email changes require a verified-email process. Contact support to request one.</p></div>
                  <div className="min-w-0 space-y-2 sm:col-span-2"><Label htmlFor="account-name">Full name</Label><Input id="account-name" value={form.full_name} maxLength={120} onChange={(event) => setForm((old) => ({ ...old, full_name: event.target.value }))} required /></div>
                  <div className="min-w-0 space-y-2"><Label htmlFor="account-phone">Phone number</Label><Input id="account-phone" inputMode="tel" value={form.phone} onChange={(event) => setForm((old) => ({ ...old, phone: event.target.value }))} /></div>
                  <div className="min-w-0 space-y-2"><Label htmlFor="account-birthday">Birthday</Label><Input id="account-birthday" type="date" className="min-w-0 max-w-full box-border text-left" max={localToday()} value={form.birth_date} onChange={(event) => setForm((old) => ({ ...old, birth_date: event.target.value }))} /><p className="text-xs text-muted-foreground">Account holders must be at least 18.</p></div>
                  <div className="sm:col-span-2"><Button disabled={savingProfile} type="submit">{savingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save information</Button></div>
                </form>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Account summary</CardTitle><CardDescription>Details currently stored for this account.</CardDescription></CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Account created</span><span className="text-right font-medium">{dateLabel(user.created_date, 'Not recorded')}</span></div>
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Account type</span><span className="capitalize font-medium">{(user.role || 'guest').replace(/_/g, ' ')}</span></div>
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Sign-in method</span><span className="font-medium">{user.has_local_password ? 'Email and password' : 'Google'}</span></div>
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">Active devices</span><span className="font-medium">{loadingSessions ? 'Loading…' : sessions.length}</span></div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="review">
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><ShieldQuestion className="h-5 w-5 text-primary" />Account review</CardTitle><CardDescription>Verification status from the account record.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-3"><Badge variant={verified ? 'default' : 'secondary'}>{verified ? 'Verified' : 'Pending email verification'}</Badge><span className="text-sm text-muted-foreground">{verified ? 'Your email address is verified.' : 'Verify the email address used to create your account before signing in.'}</span></div>
              {!verified && <p className="rounded-lg border border-border bg-muted/40 p-4 text-sm">The system currently tracks email verification only. It does not provide a separate resort-admin account review status or action-required reason.</p>}
              {verified && <p className="rounded-lg border border-border bg-muted/40 p-4 text-sm">No additional account review or action requirement is recorded.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-5">
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><LockKeyhole className="h-5 w-5 text-primary" />Login methods</CardTitle><CardDescription>Sign-in methods currently connected to this account.</CardDescription></CardHeader><CardContent className="space-y-3 text-sm"><p><span className="font-medium">Email:</span> {user.email}</p><p><span className="font-medium">Method:</span> {user.has_local_password ? 'Email and password' : 'Google Sign-In'}</p>{!user.has_local_password && <p className="rounded-lg bg-muted/50 p-3 text-muted-foreground">Password settings are managed by Google for this account.</p>}</CardContent></Card>
          {user.has_local_password ? <Card><CardHeader><CardTitle>Change password</CardTitle><CardDescription>Changing your password signs out other active devices.</CardDescription></CardHeader><CardContent><form className="max-w-xl space-y-4" onSubmit={changePassword}>
            <PasswordInput id="current-password" label="Current password" value={password.current_password} onChange={(event) => setPassword((old) => ({ ...old, current_password: event.target.value }))} autoComplete="current-password" required />
            <PasswordInput id="new-password" label="New password" value={password.new_password} onChange={(event) => setPassword((old) => ({ ...old, new_password: event.target.value }))} autoComplete="new-password" showRequirements showRequirementsOnFocus requirementsPlacement="top" confirmValue={password.confirmPassword} required />
            <PasswordInput id="confirm-password" label="Confirm new password" value={password.confirmPassword} onChange={(event) => setPassword((old) => ({ ...old, confirmPassword: event.target.value }))} autoComplete="new-password" showMatch confirmValue={password.new_password} required />
            <Button disabled={savingPassword || !passwordMeetsRequirements(password.new_password) || password.new_password !== password.confirmPassword}>{savingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Update password</Button>
          </form></CardContent></Card> : <Card><CardContent className="flex gap-3 p-5 text-sm text-muted-foreground"><ShieldCheck className="h-5 w-5 shrink-0 text-primary" />Password management is handled by the Google account provider.</CardContent></Card>}
          <Card><CardHeader><CardTitle>Verification & recovery</CardTitle><CardDescription>Keep your contact details current so account recovery can reach you.</CardDescription></CardHeader><CardContent className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">Email verification: {verified ? 'Complete' : 'Not complete'} · Last successful login is recorded from the session history below.</p><Link to={`${createPageUrl('ForgotPassword')}?email=${encodeURIComponent(user.email || '')}`} className="text-sm font-medium text-primary hover:underline">Forgot password?</Link></CardContent></Card>
        </TabsContent>

        <TabsContent value="sessions">
          <Card><CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2"><MonitorSmartphone className="h-5 w-5 text-primary" />Active sessions & devices</CardTitle><CardDescription>Sessions that are currently valid on the server.</CardDescription></div><Button variant="outline" size="sm" onClick={() => void loadSessions()} disabled={loadingSessions}><RefreshCw className={`mr-2 h-4 w-4 ${loadingSessions ? 'animate-spin' : ''}`} />Refresh</Button></CardHeader>
            <CardContent className="space-y-4">
              {sessions.filter((session) => !session.current).length > 0 && <Button variant="outline" onClick={revokeOthers} disabled={busy === 'others'}>{busy === 'others' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}<LogOut className="mr-2 h-4 w-4" />Sign out all other devices</Button>}
              {loadingSessions ? <p className="py-8 text-center text-sm text-muted-foreground">Loading sessions…</p> : sessions.length === 0 ? <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No active sessions are available. Sign in again to create a tracked session.</p> : <div className="space-y-3">{sessions.map((session) => {
                const device = describeDevice(session.user_agent);
                return <article key={session.id} className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Laptop className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2 font-medium">{device.device} · {device.browser}{session.current && <Badge>Current device</Badge>}</div><p className="text-sm text-muted-foreground">{device.os || 'Operating system unavailable'} · Signed in {dateLabel(session.created_at)}</p><p className="text-xs text-muted-foreground">Last active {dateLabel(session.last_seen_at)}</p></div>
                  {session.current ? <Button variant="outline" size="sm" onClick={() => { if (window.confirm('Sign out this device now?')) void baseClient.auth.logout('/'); }}><LogOut className="mr-2 h-4 w-4" />Sign out this device</Button> : <Button variant="destructive" size="sm" onClick={() => void revokeSession(session)} disabled={busy === session.id}>{busy === session.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}Sign out</Button>}
                </article>;
              })}</div>}
              <p className="text-xs text-muted-foreground">Browser and device names are estimated from the browser's user-agent string. Sessions created before this security feature was enabled are not listed.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card><CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-primary" />Account activity</CardTitle><CardDescription>Successful sign-ins and security changes recorded by the server.</CardDescription></div><Button variant="outline" size="sm" onClick={() => void loadActivity(1)} disabled={loadingActivity}><RefreshCw className={`mr-2 h-4 w-4 ${loadingActivity ? 'animate-spin' : ''}`} />Refresh</Button></CardHeader>
            <CardContent className="space-y-3">{activity.map((item, index) => <div key={`${item.created_at}-${index}`} className="flex gap-3 rounded-lg border border-border p-3"><Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><div><p className="text-sm font-medium">{item.description}</p><p className="text-xs text-muted-foreground">{dateLabel(item.created_at)}</p></div></div>)}{!loadingActivity && activity.length === 0 && <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No account activity has been recorded yet.</p>}{activityHasMore && <Button variant="outline" onClick={() => void loadActivity(activityPage + 1, true)} disabled={loadingActivity}>{loadingActivity && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Load older activity</Button>}<p className="text-xs text-muted-foreground">History starts when server-side account tracking is enabled; earlier activity is not available.</p></CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences">
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5 text-primary" />Notifications & preferences</CardTitle><CardDescription>Booking and payment alerts are managed by the resort system.</CardDescription></CardHeader><CardContent><p className="rounded-lg border border-border bg-muted/30 p-4 text-sm">Per-account notification preferences are not currently stored or enforced by the backend, so there are no preference switches here that could give a false impression of being saved.</p></CardContent></Card>
        </TabsContent>

        <TabsContent value="privacy">
          <div className="grid gap-5 lg:grid-cols-2">
            <Card><CardHeader><CardTitle className="flex items-center gap-2"><Database className="h-5 w-5 text-primary" />Information on this account</CardTitle><CardDescription>Personal information currently available to you.</CardDescription></CardHeader><CardContent className="space-y-3 text-sm"><p><span className="font-medium">Identity:</span> {form.full_name || 'Name not set'}, {user.email}</p><p><span className="font-medium">Contact:</span> {form.phone || 'No phone number'} · Birthday {dateInput(form.birth_date) || 'not provided'}</p><p><span className="font-medium">Profile photo:</span> {form.profile_image_url ? 'Photo stored' : 'No photo stored'}</p><p className="text-muted-foreground">Your booking and payment records are managed separately from profile settings.</p></CardContent></Card>
            <Card><CardHeader><CardTitle>Account management</CardTitle><CardDescription>Requests involving account data or account closure.</CardDescription></CardHeader><CardContent className="space-y-3 text-sm"><p>Self-service account deletion is not available. Booking and payment records may need to be retained for resort operations.</p><p>To request an account-data correction or deletion review, contact resort support so the request can be handled safely.</p><Button asChild variant="outline"><Link to={createPageUrl('Contact')}>Contact resort support</Link></Button></CardContent></Card>
          </div>
        </TabsContent>
      </Tabs>
    </main>
  );
}
