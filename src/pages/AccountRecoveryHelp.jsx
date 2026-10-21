import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { CircleHelp } from 'lucide-react';
import { baseClient } from '@/api/baseClient';
import { createPageUrl } from '@/utils';
import { RESORT_CONTACT } from '@/lib/resortContact';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export default function AccountRecoveryHelp() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recoveryForm, setRecoveryForm] = useState({
    old_email: searchParams.get('email') || '',
    requested_email: '',
    full_name: '',
    phone: '',
    booking_reference: '',
    reason: '',
  });

  const updateField = (field) => (event) => {
    setRecoveryForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const submitRecoveryRequest = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await baseClient.auth.requestAccountRecovery(recoveryForm);
      toast.success('If an eligible account was found, the request is now awaiting admin review. If approved, the reset link will be sent to your new email.');
      navigate(createPageUrl('Login'), { replace: true });
    } catch (error) {
      toast.error(error?.message || 'Unable to send the account recovery request. Please try again or contact the resort.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-muted/20 px-4 py-10 sm:px-6">
      <Card className="mx-auto max-w-lg shadow-lg shadow-black/5">
        <CardHeader>
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <CircleHelp className="h-5 w-5" />
          </div>
          <CardTitle>Recover your account</CardTitle>
          <CardDescription>If you no longer have access to your account email, send a request for resort admin review. If approved, a one-time verification and password reset link will be sent to your new email.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submitRecoveryRequest}>
            <div className="space-y-2">
              <Label htmlFor="recovery-old-email">Email currently on your account</Label>
              <Input id="recovery-old-email" type="email" autoComplete="email" maxLength={191} value={recoveryForm.old_email} onChange={updateField('old_email')} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="recovery-new-email">New email you can access</Label>
              <Input id="recovery-new-email" type="email" autoComplete="email" maxLength={191} value={recoveryForm.requested_email} onChange={updateField('requested_email')} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="recovery-name">Full name on your account</Label>
              <Input id="recovery-name" autoComplete="name" maxLength={191} value={recoveryForm.full_name} onChange={updateField('full_name')} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="recovery-phone">Phone number on your account</Label>
              <Input id="recovery-phone" type="tel" autoComplete="tel" placeholder="09XXXXXXXXX" maxLength={32} value={recoveryForm.phone} onChange={updateField('phone')} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="recovery-booking-reference">Booking reference, if you have one</Label>
              <Input id="recovery-booking-reference" maxLength={64} value={recoveryForm.booking_reference} onChange={updateField('booking_reference')} placeholder="Example: KI-XXXXXXXX" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="recovery-reason">Anything else that can help us review? (optional)</Label>
              <Textarea id="recovery-reason" maxLength={1000} value={recoveryForm.reason} onChange={updateField('reason')} rows={3} />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Sending request...' : 'Send recovery request'}
            </Button>
          </form>
          <p className="mt-4 text-xs text-muted-foreground">For your security, the admin may verify your details using the contact information already on your account. Need help? Contact us at <a className="font-medium text-primary underline" href={`mailto:${RESORT_CONTACT.email}`}>{RESORT_CONTACT.email}</a> or <a className="font-medium text-primary underline" href={`tel:${RESORT_CONTACT.phoneLink}`}>{RESORT_CONTACT.phoneDisplay}</a>. Never send us your password.</p>
          <div className="mt-6 flex justify-between gap-4 text-sm text-muted-foreground">
            <Link className="text-primary hover:underline" to={createPageUrl('ForgotPassword')}>Back to forgot password</Link>
            <Link className="text-primary hover:underline" to={createPageUrl('Login')}>Back to sign in</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
