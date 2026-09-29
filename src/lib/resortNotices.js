export const DATA_PRIVACY_NOTICE =
  "Kasa Ilaya Resort & Events Place is committed to protecting your personal information. All personal details and proofs of payment collected during the booking process are processed in strict compliance with Republic Act No. 10173 (Data Privacy Act of 2012). Your data is collected solely for reservation processing, identity verification, and guest management. We do not sell or share your personal details with unauthorized third parties. By proceeding with your booking, you consent to the collection and processing of your information for these purposes.";

export const CANCELLATION_REBOOKING_NOTICE =
  "All payments are non-refundable. Online cancellation is available only when the reservation date is more than 7 calendar days away; a cancelled paid booking is not refunded. Within 7 days, customers may request a reschedule subject to existing rescheduling rules and resort approval. If a reschedule is approved, the prior payment carries over to the new reservation date.";

export const normalizeTermsContent = (content = "") => {
  const sections = String(content)
    .split(/\n\s*\n/)
    .map((section) => section.trim())
    .filter(Boolean);
  const hasOutdatedCancellationRule = sections.some((section) =>
    /non-refundable unless|cancel.*while.*pending|cancellation.*no longer allowed once|cancellation[^.]*at least 7 days|cancellation[^.]*within 7 days[^.]*not permitted/i.test(section)
  );
  const visibleSections = sections.filter(
    (section) =>
      !/non-refundable unless|cancel.*while.*pending|cancellation.*no longer allowed once|cancellation[^.]*at least 7 days|cancellation[^.]*within 7 days[^.]*not permitted/i.test(section)
  );

  if (hasOutdatedCancellationRule) {
    visibleSections.push(
      `Cancellation and Rebooking Policy\n\n${CANCELLATION_REBOOKING_NOTICE}`
    );
  }

  if (!visibleSections.some((section) => /data privacy notice/i.test(section))) {
    visibleSections.push(`Data Privacy Notice\n\n${DATA_PRIVACY_NOTICE}`);
  }

  if (
    !visibleSections.some((section) => /exceeding.*guest|overstay|property damage/i.test(section))
  ) {
    visibleSections.push(
      "Additional Charges\n\nEach additional guest is welcome for the displayed additional guest fee. Extra charges may also apply for overstaying or property damage."
    );
  }

  return visibleSections.join("\n\n");
};
