import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { CircleHelp, Mail } from 'lucide-react';
import { baseClient } from '@/api/baseClient';
import { createPageUrl } from '@/utils';
import { RESORT_CONTACT } from '@/lib/resortContact';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRecoveryHelp, setShowRecoveryHelp] = useState(false);
  const [isSubmittingRecovery, setIsSubmittingRecovery] = useState(false);
  const [recoveryForm, setRecoveryForm] = useState({
    old_email: searchParams.get('email') || '',
    requested_email: '',
    full_name: '',
    phone: '',
    booking_reference: '',
    reason: '',
  });

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await baseClient.auth.forgotPassword({
        email,
      });

      if (response.account_status === 'not_found') {
        toast.error('No existing account was found for this email address.');
      } else if (response.account_status === 'google_only') {
        toast.error('This account uses Google Sign-In. Choose Continue with Google to sign in.');
      } else if (response.sample_reset_otp) {
        toast.success(`Temporary development reset code: ${response.sample_reset_otp}`);
        const params = new URLSearchParams({ method: 'email', email });
        params.set('sample_otp', response.sample_reset_otp);
        navigate(`${createPageUrl('ResetPassword')}?${params.toString()}`);
      } else if (response.delivery_method === 'server_log') {
        toast.success('Temporary reset code created. Check the backend logs in Render.');
        const params = new URLSearchParams({ method: 'email', email });
        params.set('delivery_method', response.delivery_method);
        navigate(`${createPageUrl('ResetPassword')}?${params.toString()}`);
      } else if (response.mail_sent === false) {
        toast.error('Reset code was created, but email delivery failed. Please check the email service settings.');
      } else {
        toast.success('If the account exists, a reset code has been sent.');
        const params = new URLSearchParams({ method: 'email', email });
        navigate(`${createPageUrl('ResetPassword')}?${params.toString()}`);
      }
    } catch (error) {
      toast.error(error.message || 'Unable to send reset code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitRecoveryRequest = async (event) => {
    event.preventDefault();
    setIsSubmittingRecovery(true);
    try {
      await baseClient.auth.requestAccountRecovery(recoveryForm);
      toast.success('If an eligible account was found, the request is now awaiting admin review. If approved, the reset link will be sent to your new email.');
      setRecoveryForm({ old_email: '', requested_email: '', full_name: '', phone: '', booking_reference: '', reason: '' });
      setShowRecoveryHelp(false);
    } catch (error) {
      toast.error(error?.message || 'Unable to send the account recovery request. Please try again or contact the resort.');
    } finally {
      setIsSubmittingRecovery(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-muted/20 px-4 py-10 sm:px-6">
      <Card className="mx-auto max-w-lg shadow-lg shadow-black/5">
        <CardHeader>
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Mail className="h-5 w-5" />
          </div>
          <CardTitle>Forgot password</CardTitle>
          <CardDescription>Enter the email on your account and we will send a password reset code.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="forgot-email">Email</Label>
              <Input id="forgot-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </div>
            <Button className="w-full" disabled={isSubmitting} type="submit">
              {isSubmitting ? 'Sending code...' : 'Send reset code'}
            </Button>
          </form>

          <div className="mt-5 border-t border-border pt-4">
            <Button type="button" variant="outline" className="w-full gap-2" onClick={() => setShowRecoveryHelp((visible) => !visible)}>
              <CircleHelp className="h-4 w-4" />
              {showRecoveryHelp ? 'Close Help' : "Help! I can't access this email"}
            </Button>
            {showRecoveryHelp ? (
              <div className="mt-4 space-y-4 rounded-xl border border-border bg-muted/30 p-4">
                <div>
                  <h2 className="font-semibold text-foreground">Recover your account</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Send a request for resort admin review. If approved, we will send a one-time verification and password reset link to your new email. For your security, the admin may verify your details using the contact information already on your account.</p>
                </div>
                <form className="space-y-3" onSubmit={submitRecoveryRequest}>
                  <div className="space-y-2">
                    <Label htmlFor="recovery-old-email">Email currently on your account</Label>
                    <Input id="recovery-old-email" type="email" autoComplete="email" maxLength={191} value={recoveryForm.old_email} onChange={(event) => setRecoveryForm((current) => ({ ...current, old_email: event.target.value }))} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="recovery-new-email">New email you can access</Label>
                    <Input id="recovery-new-email" type="email" autoComplete="email" maxLength={191} value={recoveryForm.requested_email} onChange={(event) => setRecoveryForm((current) => ({ ...current, requested_email: event.target.value }))} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="recovery-name">Full name on your account</Label>
                    <Input id="recovery-name" autoComplete="name" maxLength={191} value={recoveryForm.full_name} onChange={(event) => setRecoveryForm((current) => ({ ...current, full_name: event.target.value }))} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="recovery-phone">Phone number on your account</Label>
                    <Input id="recovery-phone" type="tel" autoComplete="tel" placeholder="09XXXXXXXXX" maxLength={32} value={recoveryForm.phone} onChange={(event) => setRecoveryForm((current) => ({ ...current, phone: event.target.value }))} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="recovery-booking-reference">Booking reference, if you have one</Label>
                    <Input id="recovery-booking-reference" maxLength={64} value={recoveryForm.booking_reference} onChange={(event) => setRecoveryForm((current) => ({ ...current, booking_reference: event.target.value }))} placeholder="Example: KI-XXXXXXXX" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="recovery-reason">Anything else that can help us review? (optional)</Label>
                    <Textarea id="recovery-reason" maxLength={1000} value={recoveryForm.reason} onChange={(event) => setRecoveryForm((current) => ({ ...current, reason: event.target.value }))} rows={3} />
                  </div>
                  <Button type="submit" className="w-full" disabled={isSubmittingRecovery}>
                    {isSubmittingRecovery ? 'Sending request...' : 'Send recovery request'}
                  </Button>
                </form>
                <p className="text-xs text-muted-foreground">Need help? Contact us through our official email <a className="font-medium text-primary underline" href={`mailto:${RESORT_CONTACT.email}`}>{RESORT_CONTACT.email}</a> or call <a className="font-medium text-primary underline" href={`tel:${RESORT_CONTACT.phoneLink}`}>{RESORT_CONTACT.phoneDisplay}</a>. Never send us your password.</p>
              </div>
            ) : null}
          </div>

          <div className="mt-6 text-sm text-muted-foreground">
            <Link className="text-primary hover:underline" to={createPageUrl('Login')}>Back to sign in</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
