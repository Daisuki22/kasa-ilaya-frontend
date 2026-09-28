import React, { useState, useRef, useEffect } from "react";
import { baseClient } from "@/api/baseClient";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, X, Loader2, TreePalm } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { RESORT_CONTACT } from "@/lib/resortContact";
import { useSiteSettings } from "@/hooks/useSiteSettings";

const QUICK_QUESTIONS = [
  "How can I make a reservation?",
  "How can I reschedule my reservation?",
  "How can I cancel or modify my reservation?",
  "How can I send an inquiry?",
  "How can I contact Kasa Ilaya?",
  "How can I view the schedule and calendar?",
  "What are the requirements for booking?",
  "What payment options are available?",
  "Can I make a group reservation?",
  "How can I check availability?",
  "How can I get help with my reservation?",
];

const assistantReply = ({
  title,
  intro,
  paragraphs = [],
  bullets = [],
  steps = [],
  important,
  nextStep,
}) => {
  const sections = [`### ${title}`];

  if (intro) {
    sections.push(bullets.length || steps.length ? intro : `- ${intro}`);
  }

  sections.push(...paragraphs);

  if (bullets.length) {
    sections.push(bullets.map((item) => `- ${item}`).join("\n"));
  }

  if (steps.length) {
    sections.push(
      steps.map((step, index) => `${index + 1}. ${step}`).join("\n")
    );
  }

  if (important) sections.push(`**Important:** ${important}`);
  if (nextStep) sections.push(`**Next step:** ${nextStep}`);

  return sections.filter(Boolean).join("\n\n");
};

const groupPackagesByName = (packages) => {
  const grouped = new Map();

  packages.forEach((pkg) => {
    if (!grouped.has(pkg.name)) {
      grouped.set(pkg.name, []);
    }

    grouped.get(pkg.name).push(pkg);
  });

  return [...grouped.entries()].map(([name, packageOptions]) => ({
    name,
    options: packageOptions.sort((left, right) => {
      const order = {
        day_tour: 0,
        night_tour: 1,
        "22_hours": 2,
      };

      return (order[left.tour_type] ?? 99) - (order[right.tour_type] ?? 99);
    }),
  }));
};

const buildLocalResponse = (message, packages, siteSettings) => {
  const prompt = message.toLowerCase().trim();
  const groupedPackages = groupPackagesByName(packages || []);
  const siteName = siteSettings?.site_name?.trim() || "Kasa Ilaya";

  const termsSummary =
    siteSettings?.terms_summary?.trim() ||
    "Bookings are subject to availability and admin confirmation.";

  /*
   * Exact answers for the Quick Questions buttons.
   * These are checked first so each button always gets its intended answer.
   */
  const quickQuestionAnswers = {
    "how can i make a reservation?": assistantReply({
      title: "How can I make a reservation?",
      intro: "You can make a reservation online through the Packages page.",
      steps: [
        "Sign in to your account.",
        "Open Packages and choose your preferred package.",
        "Select your preferred date and tour type.",
        "Enter the required guest details and any special requests.",
        "Follow the payment instructions and upload your payment receipt.",
        "Wait for the resort team to review and confirm your reservation.",
      ],
      important:
        "Reservations are subject to availability and resort confirmation.",
      nextStep: "Open the Packages page to start your reservation.",
    }),

    "how can i reschedule my reservation?": assistantReply({
      title: "How can I reschedule my reservation?",
      intro: "Eligible reservations can request a new date through My Booking.",
      bullets: [
        "The reservation must be pending or confirmed.",
        "Only one rebooking can be approved per reservation.",
        "Submit the request at least 7 days before the reservation date.",
        "The new date must be available for the same package and tour type.",
      ],
      important:
        "The original reservation date remains active until the resort approves the request.",
      nextStep:
        "Open My Booking and check the available actions for your reservation.",
    }),

    "how can i cancel or modify my reservation?": assistantReply({
      title: "How can I cancel or modify my reservation?",
      intro:
        "Available cancellation or modification actions depend on your reservation status and the resort's booking policy.",
      steps: [
        "Open My Booking.",
        "Select the reservation you want to manage.",
        "Review the available actions for that reservation.",
        "Follow the instructions shown for the selected action.",
      ],
      nextStep:
        "If you need additional assistance, send an inquiry through the Contact page.",
    }),

    "how can i send an inquiry?": assistantReply({
      title: "How can I send an inquiry?",
      intro: "You can send an inquiry through the Contact page.",
      steps: [
        "Open the Contact page.",
        "Enter your name and email.",
        "Add a subject and your message.",
        "Submit the inquiry.",
      ],
      nextStep:
        "Return to the Contact page if you need to continue the conversation with the resort team.",
    }),

    "how can i contact kasa ilaya?": assistantReply({
      title: "How can I contact Kasa Ilaya?",
      intro:
        "You can contact Kasa Ilaya through the Contact page or use the resort contact details below.",
      bullets: [
        `**Phone:** ${RESORT_CONTACT.phoneDisplay}`,
        `**Email:** ${RESORT_CONTACT.email}`,
        `**Address:** ${RESORT_CONTACT.address}`,
        `**Hours:** ${RESORT_CONTACT.hours}`,
      ],
      nextStep: "Open the Contact page for the map and inquiry form.",
    }),

    "how can i view the schedule and calendar?": assistantReply({
      title: "How can I view the schedule and calendar?",
      intro:
        "The website calendar shows upcoming schedules and reserved dates to help you review availability.",
      steps: [
        "Open the Packages page.",
        "Choose the package you are interested in.",
        "Open its booking calendar.",
        "Review the available and reserved dates.",
      ],
      nextStep: "Choose a package to check its booking calendar.",
    }),

    "what are the requirements for booking?": assistantReply({
      title: "What are the requirements for booking?",
      intro: "Prepare these details before starting your reservation:",
      bullets: [
        "An account",
        "Your preferred package, date, and tour type",
        "The number of guests and contact details",
        "Proof of payment following the instructions shown during booking",
      ],
      nextStep:
        "For special group requests, contact the resort directly through the Contact page.",
    }),

    "what payment options are available?": assistantReply({
      title: "What payment options are available?",
      intro:
        "The booking flow displays the payment instructions and methods currently available for your reservation.",
      steps: [
        "Follow the payment instructions shown during booking.",
        "Complete the payment using the available method.",
        "Upload a clear image of your payment proof.",
        "Wait for the resort team to verify your payment.",
      ],
      important:
        "Your reservation is not confirmed until it has been reviewed by the resort.",
    }),

    "can i make a group reservation?": assistantReply({
      title: "Can I make a group reservation?",
      intro:
        "Yes. The resort team can assist with availability and details for larger groups or special events.",
      nextStep:
        "Send an inquiry through the Contact page with your group size, preferred date, package, and event details.",
    }),

    "how can i check availability?": assistantReply({
      title: "How can I check availability?",
      intro:
        "The booking calendar displays current reservation availability.",
      bullets: [
        "Reserved dates cannot be selected.",
        "Package cards also show availability information.",
      ],
      nextStep:
        "Choose a package to view its calendar and available dates.",
    }),

    "how can i get help with my reservation?": assistantReply({
      title: "How can I get help with my reservation?",
      intro:
        "You can manage your reservation through My Booking or contact the resort team for assistance.",
      steps: [
        "Open My Booking to review your reservation and available actions.",
        "Check whether your reservation is pending or confirmed.",
        "For questions that cannot be resolved through My Booking, send an inquiry through the Contact page.",
      ],
      nextStep: "Open My Booking or the Contact page to continue.",
    }),
  };

  if (quickQuestionAnswers[prompt]) {
    return quickQuestionAnswers[prompt];
  }

  if (
    prompt.includes("what is") ||
    prompt.includes("about") ||
    prompt.includes("who are") ||
    prompt.includes("website")
  ) {
    return assistantReply({
      title: `About ${siteName}`,
      intro: `${siteName} Resort & Event Place helps guests explore resort stays, private gatherings, and event planning.`,
      bullets: [
        "Browse packages and amenities.",
        "Check upcoming schedules and guest reviews.",
        "Send an inquiry through the Contact page.",
      ],
    });
  }

  if (prompt.includes("amenity") || prompt.includes("amenities")) {
    const amenities = Array.isArray(siteSettings?.amenities)
      ? siteSettings.amenities
      : [];

    if (amenities.length === 0) {
      return assistantReply({
        title: "Resort amenities",
        intro:
          "The Amenities page has the latest information about resort facilities.",
        nextStep: "Open the Amenities page to view the available amenities.",
      });
    }

    return assistantReply({
      title: "Resort amenities",
      intro: "Here are some of the available facilities:",
      bullets: amenities
        .slice(0, 6)
        .map(
          (item) =>
            `${item.title || "Amenity"}${
              item.desc ? `: ${item.desc}` : ""
            }`
        ),
      nextStep: "Open the Amenities page for more details.",
    });
  }

  if (
    prompt.includes("package") ||
    prompt.includes("price") ||
    prompt.includes("tour")
  ) {
    if (groupedPackages.length === 0) {
      return assistantReply({
        title: "Resort packages",
        intro: "No packages are available right now.",
        nextStep: "Please check the Packages page again later.",
      });
    }

    const lines = groupedPackages.map(({ name, options }) => {
      const variants = options
        .map((pkg) => {
          const label =
            pkg.tour_type === "day_tour"
              ? "Day Tour"
              : pkg.tour_type === "night_tour"
              ? "Night Tour"
              : "22 Hours";

          return `${label}: PHP ${Number(
            pkg.price || 0
          ).toLocaleString()} for up to ${pkg.max_guests} guests`;
        })
        .join(" | ");

      return `**${name}:** ${variants}`;
    });

    return assistantReply({
      title: "Resort packages",
      intro: "Available packages and tour options:",
      bullets: lines,
      nextStep:
        "Open the Packages page to compare options and continue to booking.",
    });
  }

  if (
    prompt.includes("new") ||
    prompt.includes("first time") ||
    prompt.includes("beginner") ||
    prompt.includes("help me")
  ) {
    return assistantReply({
      title: "Getting started",
      intro: "New guests can reserve online in a few steps:",
      steps: [
        "Sign in to your account.",
        "Choose a package, date, and tour type.",
        "Enter your guest details.",
        "Follow the payment instructions and upload proof of payment.",
      ],
      important:
        "The resort team reviews your booking and payment before confirming the reservation.",
    });
  }

  if (
    prompt.includes("how do i reserve") ||
    prompt.includes("how to reserve") ||
    prompt.includes("how to book") ||
    prompt.includes("how do i book") ||
    prompt.includes("reservation process") ||
    prompt.includes("make a reservation") ||
    prompt.includes("making a reservation")
  ) {
    return assistantReply({
      title: "How to reserve",
      intro: "To request a reservation:",
      steps: [
        "Sign in to your account.",
        "Open Packages and choose your preferred package.",
        "Select a date and tour type.",
        "Enter the guest details and any special requests.",
        "Follow the payment instructions and upload your receipt.",
        "Wait for the resort team to review your request.",
      ],
      important:
        "Only one active reservation is allowed for the same package, date, and tour type. Your booking is subject to availability and confirmation.",
    });
  }

  if (
    prompt.includes("need") ||
    prompt.includes("requirements") ||
    prompt.includes("what are the requirements")
  ) {
    if (
      prompt.includes("book") ||
      prompt.includes("reservation") ||
      prompt.includes("reserve")
    ) {
      return assistantReply({
        title: "What you need to book",
        intro: "Prepare these details before you start:",
        bullets: [
          "An account",
          "Your preferred package, date, and tour type",
          "The number of guests and contact details",
          "Proof of payment, following the instructions shown during booking",
        ],
        nextStep: "For special group requests, contact the resort directly.",
      });
    }
  }

  if (
    (prompt.includes("book") ||
      prompt.includes("reservation") ||
      prompt.includes("reserve")) &&
    !prompt.includes("group") &&
    !prompt.includes("event") &&
    !prompt.includes("large") &&
    !prompt.includes("payment") &&
    !prompt.includes("receipt") &&
    !prompt.includes("pay")
  ) {
    return assistantReply({
      title: "Booking a reservation",
      intro:
        "Sign in, choose a package, select a date and tour type, then enter your guest details and follow the payment instructions.",
      important:
        "Only one active reservation is allowed for a package date and tour type. All requests are subject to availability and resort confirmation.",
      nextStep: "Open the Packages page to begin.",
    });
  }

  if (
    prompt.includes("payment") ||
    prompt.includes("receipt") ||
    prompt.includes("gcash") ||
    prompt.includes("maya") ||
    prompt.includes("pay") ||
    prompt.includes("payment options")
  ) {
    return assistantReply({
      title: "Reservation payment",
      intro:
        "The booking flow shows the available payment instructions and methods.",
      steps: [
        "Follow the payment instructions shown during booking.",
        "Upload a clear image of your payment proof.",
        "Wait for the resort team to verify the payment.",
      ],
      important:
        "Your reservation is not confirmed until it has been reviewed by the resort.",
    });
  }

  if (
    prompt.includes("available") ||
    prompt.includes("availability") ||
    prompt.includes("date")
  ) {
    return assistantReply({
      title: "Check availability",
      intro: "The booking calendar displays current reservation availability.",
      bullets: [
        "Reserved dates cannot be selected.",
        "Package cards also show availability information.",
      ],
      nextStep: "Choose a package to view its calendar and available dates.",
    });
  }

  if (
    prompt.includes("group") ||
    prompt.includes("guests") ||
    prompt.includes("event") ||
    prompt.includes("large")
  ) {
    return assistantReply({
      title: "Group bookings and events",
      intro:
        "The resort team can help with availability and details for larger groups or special events.",
      nextStep: "Send an inquiry through the Contact page.",
    });
  }

  if (
    prompt.includes("rebook") ||
    prompt.includes("reschedule") ||
    prompt.includes("reschedule my reservation")
  ) {
    return assistantReply({
      title: "Rebooking",
      intro: "Eligible reservations can request a new date from My Booking.",
      bullets: [
        "The booking must be pending or confirmed.",
        "Only one rebooking can be approved per reservation.",
        "Submit the request at least 7 days before the reservation date.",
        "Choose an available date for the same package and tour type.",
      ],
      important:
        "The original date remains active until the resort approves the request.",
      nextStep:
        "Open My Booking to check the available actions for your reservation.",
    });
  }

  if (
    prompt.includes("cancel") ||
    prompt.includes("change") ||
    prompt.includes("modify")
  ) {
    return assistantReply({
      title: "Changes or cancellations",
      intro:
        "Available actions depend on your reservation status and resort policy.",
      nextStep:
        "Open My Booking to review the actions available for your reservation. Eligible bookings can request rebooking there.",
    });
  }

  if (
    prompt.includes("inquiry") ||
    prompt.includes("message") ||
    prompt.includes("chat with admin") ||
    prompt.includes("contact form")
  ) {
    return assistantReply({
      title: "Send an inquiry",
      intro: "Use the Contact page to send a message to the resort team.",
      steps: [
        "Enter your name and email.",
        "Add a subject and your message.",
        "Submit the inquiry and return to the Contact page to continue the conversation.",
      ],
    });
  }

  if (
    prompt.includes("contact") ||
    prompt.includes("location") ||
    prompt.includes("where") ||
    prompt.includes("map") ||
    prompt.includes("phone") ||
    prompt.includes("email")
  ) {
    return assistantReply({
      title: "Contact Kasa Ilaya",
      intro:
        "You can reach the resort through the Contact page or use these details:",
      bullets: [
        `**Phone:** ${RESORT_CONTACT.phoneDisplay}`,
        `**Email:** ${RESORT_CONTACT.email}`,
        `**Address:** ${RESORT_CONTACT.address}`,
        `**Hours:** ${RESORT_CONTACT.hours}`,
      ],
      nextStep: "The Contact page also has a map and inquiry form.",
    });
  }

  if (
    prompt.includes("schedule") ||
    prompt.includes("calendar") ||
    prompt.includes("event")
  ) {
    return assistantReply({
      title: "Schedules and calendar",
      intro:
        "The website calendar shows upcoming schedules and reserved dates to help you review availability.",
      nextStep: "Choose a package to check its booking calendar.",
    });
  }

  if (
    prompt.includes("review") ||
    prompt.includes("testimonial") ||
    prompt.includes("feedback")
  ) {
    return assistantReply({
      title: "Guest reviews",
      intro:
        "The home page features verified guest reviews and feedback about their resort experiences.",
    });
  }

  if (
    prompt.includes("rule") ||
    prompt.includes("terms") ||
    prompt.includes("policy")
  ) {
    return assistantReply({
      title: "Resort rules and booking terms",
      intro: termsSummary,
      nextStep: "Review the full terms during the booking process.",
    });
  }

  if (
    prompt.includes("admin") ||
    prompt.includes("super admin") ||
    prompt.includes("staff")
  ) {
    return assistantReply({
      title: "Staff and admin support",
      intro: "Admin tools are available to authorized staff.",
      bullets: [
        "Staff can manage bookings, schedules, and inquiries.",
        "Super admins can also manage user permissions, system and security settings, and activity logs.",
      ],
    });
  }

  if (prompt.includes("lost") || prompt.includes("found")) {
    return assistantReply({
      title: "Lost and found",
      intro:
        "A Lost and Found section is not currently available on this website.",
      nextStep:
        "I can still help with packages, bookings, contact inquiries, schedules, reviews, and resort information.",
    });
  }

  return null;
};
export default function Chatbot() {
  const { settings: siteSettings } = useSiteSettings();
  const [open, setOpen] = useState(false);
  const [showHint, setShowHint] = useState(true);

  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: assistantReply({
        title: "Welcome to Kasa Ilaya Resort",
        intro: "How can I help with your visit?",
        nextStep: "Choose a quick message below.",
      }),
    },
  ]);

  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const { data: packages = [] } = useQuery({
    queryKey: ["chatbot-packages"],
    queryFn: () =>
      baseClient.entities.Package.filter({ is_active: true }, "name"),
    staleTime: 60000,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  useEffect(() => {
    if (open) {
      setShowHint(false);
      return;
    }

    setShowHint(true);

    let showTimeout;
    let hideTimeout;

    const runHintCycle = () => {
      setShowHint(true);

      hideTimeout = window.setTimeout(() => {
        setShowHint(false);
      }, 5000);

      showTimeout = window.setTimeout(runHintCycle, 10000);
    };

    runHintCycle();

    return () => {
      window.clearTimeout(showTimeout);
      window.clearTimeout(hideTimeout);
    };
  }, [open]);

  const processMessage = async (rawMessage) => {
    if (!rawMessage.trim() || loading) return;

    const userMsg = {
      role: "user",
      content: rawMessage.trim(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const localResponse = buildLocalResponse(
        rawMessage,
        packages,
        siteSettings
      );

      if (localResponse) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: localResponse,
          },
        ]);
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: assistantReply({
            title: "How can I help?",
            intro:
              "I can help with resort information and booking questions.",
            nextStep: "Choose one of the quick messages below.",
          }),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: assistantReply({
            title: "How can I help?",
            intro:
              "I can help with resort information and booking questions.",
            nextStep: "Choose one of the quick messages below.",
          }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      <div className="fixed bottom-4 right-4 z-50 flex max-w-[calc(100vw-2rem)] items-center gap-3 sm:bottom-6 sm:right-6">
        <div
          className={`pointer-events-none hidden max-w-[14rem] rounded-full border border-primary/20 bg-card px-4 py-2 text-sm font-medium text-foreground shadow-lg transition-all duration-500 sm:block ${
            showHint
              ? "translate-x-0 scale-100 opacity-100"
              : "translate-x-3 scale-95 opacity-0"
          }`}
          aria-hidden={!showHint}
        >
          Kasa Ilaya Will
          <br />
          Assist You
        </div>

        <button
          onClick={() => setOpen(!open)}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all hover:scale-105 hover:shadow-xl sm:h-14 sm:w-14"
          aria-label={open ? "Close chatbot" : "Open chatbot"}
        >
          {open ? (
            <X className="h-6 w-6" />
          ) : (
            <MessageCircle className="h-6 w-6" />
          )}
        </button>
      </div>

      {/* Chat window */}
      {open && (
        <div className="fixed inset-x-3 bottom-20 z-50 flex h-[min(70vh,520px)] flex-col overflow-hidden rounded-lg border border-border bg-card shadow-2xl sm:inset-x-auto sm:bottom-24 sm:right-6 sm:h-[480px] sm:w-[360px] sm:max-w-[calc(100vw-48px)]">
          {/* Header */}
          <div className="bg-primary text-primary-foreground px-4 py-3 flex items-center gap-3">
            <TreePalm className="h-5 w-5" />

            <div>
              <p className="font-semibold text-sm">
                Kasa Ilaya Assistant
              </p>
              <p className="text-xs opacity-80">
                Quick messages only
              </p>
            </div>
          </div>

          {/* Messages */}
          <div
            className="flex-1 space-y-3 overflow-y-auto p-4"
            role="log"
            aria-live="polite"
            aria-relevant="additions"
          >
            {messages.map((msg, i) => (
              <div
                key={i}
                role="group"
                aria-label={
                  msg.role === "user"
                    ? "Your message"
                    : "Kasa Ilaya Assistant message"
                }
                className={`flex ${
                  msg.role === "user"
                    ? "justify-end"
                    : "justify-start"
                }`}
              >
                <div
                  className={`min-w-0 max-w-[85%] break-words rounded-lg px-3.5 py-2.5 text-sm leading-relaxed [overflow-wrap:anywhere] ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-muted text-foreground rounded-bl-md"
                  }`}
                >
                  {msg.role === "user" ? (
                    <p className="m-0 whitespace-pre-wrap">
                      {msg.content}
                    </p>
                  ) : (
                    <ReactMarkdown
                      className="max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_h3]:mb-2 [&_h3]:text-sm [&_h3]:font-semibold [&_li]:my-1 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5"
                    >
                      {msg.content}
                    </ReactMarkdown>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div
                className="flex justify-start"
                role="status"
                aria-label="Assistant is responding"
              >
                <div className="rounded-lg rounded-bl-md bg-muted px-4 py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}

            {!loading && (
              <div className="flex flex-wrap gap-2 pt-2">
                {QUICK_QUESTIONS.map((question) => (
                  <button
                    key={question}
                    type="button"
                    className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
                    onClick={() => processMessage(question)}
                  >
                    {question}
                  </button>
                ))}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>
      )}
    </>
  );
}