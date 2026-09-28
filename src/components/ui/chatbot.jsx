import React, { useState, useRef, useEffect } from "react";
import { baseClient } from "@/api/baseClient";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, X, Loader2, TreePalm, ArrowLeft, Search } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { RESORT_CONTACT } from "@/lib/resortContact";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useResortRules } from "@/hooks/useResortRules";

const FAQ_CATEGORIES = [
  {
    title: "Reservations & Booking",
    questions: [
      "How can I make a reservation?",
      "How can I check my reservation status?",
      "Can I modify my reservation?",
      "What information do I need to make a reservation?",
    ],
  },
  {
    title: "Rates & Packages",
    questions: [
      "What are your rates?",
      "What packages are available?",
      "What is included in the package?",
    ],
  },
  {
    title: "Resort Facilities",
    questions: [
      "What facilities are available?",
      "Is swimming available?",
      "What amenities are included?",
    ],
  },
  {
    title: "Events & Venue",
    questions: [
      "Can I book the resort for an event?",
      "What events can be hosted?",
      "What event packages are available?",
    ],
  },
  {
    title: "Payment",
    questions: [
      "What payment methods are accepted?",
      "How much is the required payment?",
      "How can I confirm my payment?",
    ],
  },
  {
    title: "Cancellation & Refund",
    questions: [
      "What is the cancellation policy?",
      "Can I cancel my reservation?",
      "Can I get a refund after cancelling a paid reservation?",
    ],
  },
  {
    title: "Check-in & Check-out",
    questions: [
      "What time is check-in?",
      "What time is check-out?",
      "What should I bring during check-in?",
    ],
  },
  {
    title: "Location & Contact",
    questions: [
      "Where is Kasa Ilaya Resort located?",
      "How can I contact the resort?",
      "What are your contact details?",
    ],
  },
  {
    title: "Rules & Policies",
    questions: [
      "What are the resort rules?",
      "Are outside food and drinks allowed?",
      "What are the policies for guests?",
    ],
  },
];

const getVisibleFaqCategories = (search, selectedCategory) => {
  const normalizedSearch = search.trim().toLowerCase();

  if (!normalizedSearch) {
    return FAQ_CATEGORIES.filter(
      (category) => category.title === selectedCategory
    );
  }

  return FAQ_CATEGORIES.map((category) => ({
    ...category,
    questions: category.title.toLowerCase().includes(normalizedSearch)
      ? category.questions
      : category.questions.filter((question) =>
          question.toLowerCase().includes(normalizedSearch)
        ),
  })).filter((category) => category.questions.length > 0);
};

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

const buildLocalResponse = (
  message,
  packages,
  siteSettings,
  resortRules = [],
  paymentQrCodes = []
) => {
  const prompt = message.toLowerCase().trim();
  const groupedPackages = groupPackagesByName(packages || []);
  const siteName = siteSettings?.site_name?.trim() || "Kasa Ilaya";
  const amenities = Array.isArray(siteSettings?.amenities)
    ? siteSettings.amenities
    : [];
  const packageBullets = (includeInclusions = false) =>
    groupedPackages.map(({ name, options }) => {
      const variants = options
        .map((pkg) => {
          const label =
            pkg.tour_type === "day_tour"
              ? "Day Tour"
              : pkg.tour_type === "night_tour"
              ? "Night Tour"
              : "22 Hours";
          const priceField = {
            day_tour: "day_tour_price",
            night_tour: "night_tour_price",
            "22_hours": "twenty_two_hour_price",
          }[pkg.tour_type];
          const price = Number(
            pkg[priceField] ?? pkg.price ?? 0
          ).toLocaleString();
          const capacity = pkg.max_guests
            ? `, up to ${pkg.max_guests} guests`
            : "";
          const inclusions = Array.isArray(pkg.inclusions)
            ? pkg.inclusions.filter(Boolean)
            : [];
          const includedText =
            includeInclusions && inclusions.length
              ? `; includes ${inclusions.join(", ")}`
              : "";

          return `${label}: PHP ${price}${capacity}${includedText}`;
        })
        .join("; ");

      return `**${name}:** ${variants}`;
    });
  const paymentMethodLabels = [
    ...new Set(
      (Array.isArray(paymentQrCodes) ? paymentQrCodes : [])
        .map((item) => item?.label?.trim())
        .filter(Boolean)
    ),
  ];
  const activeRules = (Array.isArray(resortRules) ? resortRules : []).filter(
    (rule) => rule?.title && rule?.description
  );

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

    "how can i check my reservation status?": assistantReply({
      title: "Check your reservation status",
      intro: "Your booking status is available in your account.",
      steps: ["Sign in using the account used for the booking.", "Open My Booking.", "Select the reservation to view its current status and details."],
    }),

    "can i modify my reservation?": assistantReply({
      title: "Modify a reservation",
      intro: "Available changes depend on the reservation status and resort policy.",
      nextStep: "Open My Booking to see available actions, or contact the resort for help.",
    }),

    "what information do i need to make a reservation?": assistantReply({
      title: "Information needed to book",
      intro: "Have these details ready:",
      bullets: ["A guest account", "Package, date, and tour type", "Guest count and contact information", "Payment proof after following the booking instructions"],
    }),

    "what are your rates?": assistantReply({
      title: "Rates and packages",
      intro: groupedPackages.length ? "Current listed package rates:" : "Package rates are not available right now.",
      bullets: packageBullets(),
      nextStep: "Open Packages to review current options and availability.",
    }),

    "what packages are available?": assistantReply({
      title: "Available packages",
      intro: groupedPackages.length ? "These packages are currently listed:" : "No packages are available right now.",
      bullets: packageBullets(),
      nextStep: "Open Packages to compare tour options and dates.",
    }),

    "what is included in the package?": assistantReply({
      title: "Package inclusions",
      intro: groupedPackages.length ? "Package details and listed inclusions:" : "Package details are not available right now.",
      bullets: packageBullets(true),
      nextStep: "Open a package card for its full details.",
    }),

    "what facilities are available?": assistantReply({
      title: "Resort facilities",
      intro: amenities.length ? "Facilities listed by the resort:" : "Please check the Amenities page for the latest facility information.",
      bullets: amenities.slice(0, 10).map((item) => `${item.title || "Facility"}${item.desc ? `: ${item.desc}` : ""}`),
      nextStep: "Open Amenities to view the full list.",
    }),

    "is swimming available?": (() => {
      const pool = amenities.find((item) => /swim|pool/i.test(`${item.title || ""} ${item.desc || ""}`));
      return assistantReply({
        title: "Swimming facilities",
        intro: pool
          ? `${pool.title}${pool.desc ? `: ${pool.desc}` : " is listed among the resort amenities."}`
          : "Swimming availability is not specified in the current amenity information.",
        nextStep: pool ? "Check the Amenities page for current details." : "Contact the resort to confirm before your visit.",
      });
    })(),

    "what amenities are included?": assistantReply({
      title: "Resort amenities",
      intro: amenities.length ? "Amenities currently listed by the resort:" : "Amenity details are not available right now.",
      bullets: amenities.slice(0, 10).map((item) => `${item.title || "Amenity"}${item.desc ? `: ${item.desc}` : ""}`),
      nextStep: "Open Amenities for the full list and details.",
    }),

    "can i book the resort for an event?": assistantReply({
      title: "Events and venue bookings",
      intro: "The resort has an event venue. Availability and arrangements depend on your event details and preferred date.",
      nextStep: "Send an inquiry with your event type, group size, and preferred date so the resort team can confirm options.",
    }),

    "what events can be hosted?": assistantReply({
      title: "Events at Kasa Ilaya",
      intro: "The resort website presents its venue for celebrations, reunions, and special occasions.",
      nextStep: "Contact the resort with your event details to confirm suitability and availability.",
    }),

    "what event packages are available?": assistantReply({
      title: "Event packages",
      intro: groupedPackages.length ? "Current resort packages are listed below; event-specific arrangements should be confirmed with the team." : "Event package details are not listed right now.",
      bullets: packageBullets(),
      nextStep: "Send an inquiry through Contact with your event type, group size, and date.",
    }),

    "what payment methods are accepted?": assistantReply({
      title: "Accepted payment methods",
      intro: paymentMethodLabels.length
        ? "Payment methods currently configured for booking:"
        : "Available payment instructions are shown during booking.",
      bullets: paymentMethodLabels,
      nextStep: "Check the Payment step for the current instructions before submitting proof.",
    }),

    "how much is the required payment?": assistantReply({
      title: "Required reservation payment",
      intro: "The booking flow offers a reservation downpayment or full payment.",
      bullets: ["Downpayment: 15% of the booking total.", "Full payment: the full booking amount."],
      important: "The exact amount is calculated and shown after you choose a package and guest count.",
    }),

    "how can i confirm my payment?": assistantReply({
      title: "Confirm a payment",
      steps: ["Follow the payment instructions shown in your booking.", "Upload a clear payment receipt.", "Wait for the resort team to verify it."],
      important: "The booking remains subject to resort review and confirmation.",
    }),

    "what is the cancellation policy?": assistantReply({
      title: "Cancellation policy",
      bullets: ["Guests may cancel online while a booking is pending.", "Online cancellation is not available once a booking is marked paid or approved by the resort.", "Reservation payments are non-refundable unless the resort approves otherwise in writing."],
      nextStep: "Review the full current terms during booking or contact the resort about your reservation.",
    }),

    "can i cancel my reservation?": assistantReply({
      title: "Cancel a reservation",
      intro: "Online cancellation is available while your booking is still pending.",
      nextStep: "Open My Booking and check the actions available for your reservation. Contact the resort if it is already paid or approved.",
    }),

    "can i get a refund after cancelling a paid reservation?": assistantReply({
      title: "Refunds for cancelled bookings",
      intro: "Reservation fees and payments are non-refundable under the published booking terms unless Kasa Ilaya Resort approves an exception in writing.",
      nextStep: "Contact the resort directly to discuss a specific payment or cancellation.",
    }),

    "what time is check-in?": assistantReply({
      title: "Check-in time",
      intro: "Check-in follows the tour time selected for your reservation:",
      bullets: ["Day Tour: 8 AM.", "Night Tour: 6 PM.", "22 Hours: 6 PM."],
      important: "Arrive within your reserved tour schedule.",
    }),

    "what time is check-out?": assistantReply({
      title: "Check-out time",
      intro: "Check-out depends on the selected tour:",
      bullets: ["Day Tour: 6 PM.", "Night Tour: 6 AM.", "22 Hours: 4 PM the following day."],
      important: "Follow the schedule shown on your reservation confirmation.",
    }),

    "what should i bring during check-in?": assistantReply({
      title: "Check-in essentials",
      bullets: ["Your booking reference code.", "Your reservation confirmation and any instructions sent by the resort."],
      important: "Guests must arrive within their reserved tour schedule.",
    }),

    "where is kasa ilaya resort located?": assistantReply({
      title: "Resort location",
      intro: RESORT_CONTACT.address,
      nextStep: "Use the map on the Contact page for directions.",
    }),

    "how can i contact the resort?": assistantReply({
      title: "Contact Kasa Ilaya",
      bullets: [`**Phone:** ${RESORT_CONTACT.phoneDisplay}`, `**Email:** ${RESORT_CONTACT.email}`],
      nextStep: "Open Contact for the map and inquiry form.",
    }),

    "what are your contact details?": assistantReply({
      title: "Contact details",
      bullets: [`**Phone:** ${RESORT_CONTACT.phoneDisplay}`, `**Email:** ${RESORT_CONTACT.email}`, `**Address:** ${RESORT_CONTACT.address}`, `**Hours:** ${RESORT_CONTACT.hours}`],
    }),

    "what are the resort rules?": assistantReply({
      title: "Resort rules",
      intro: activeRules.length ? "Please follow the current rules published by the resort:" : "Please review the rules shown during booking.",
      bullets: activeRules.map((rule) => `**${rule.title}:** ${rule.description}`),
    }),

    "are outside food and drinks allowed?": (() => {
      const outsideFoodRule = activeRules.find((rule) => /outside|food|drink/i.test(`${rule.title} ${rule.description}`));
      return assistantReply({
        title: "Outside food and drinks",
        intro: outsideFoodRule
          ? `${outsideFoodRule.title}: ${outsideFoodRule.description}`
          : "The published resort rules do not specify whether outside food or drinks are allowed.",
        nextStep: outsideFoodRule ? undefined : "Contact the resort before bringing outside food or drinks.",
      });
    })(),

    "what are the policies for guests?": assistantReply({
      title: "Guest policies",
      intro: activeRules.length ? "Current guest rules and policies:" : "Review the current terms and policies during booking.",
      bullets: activeRules.map((rule) => `**${rule.title}:** ${rule.description}`),
      nextStep: "Read the booking terms before submitting a reservation.",
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
  const { rules: resortRules } = useResortRules();
  const [open, setOpen] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const [showFaq, setShowFaq] = useState(true);
  const [selectedFaqCategory, setSelectedFaqCategory] = useState(
    FAQ_CATEGORIES[0].title
  );
  const [faqSearch, setFaqSearch] = useState("");

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
  const messagesContainerRef = useRef(null);

  const { data: packages = [] } = useQuery({
    queryKey: ["chatbot-packages"],
    queryFn: () =>
      baseClient.entities.Package.filter({ is_active: true }, "name"),
    staleTime: 60000,
  });

  const { data: paymentQrCodes = [] } = useQuery({
    queryKey: ["chatbot-payment-methods"],
    queryFn: () => baseClient.entities.PaymentQrCode.list("display_order", 10),
    staleTime: 60000,
  });

  const normalizedFaqSearch = faqSearch.trim().toLowerCase();
  const visibleFaqCategories = getVisibleFaqCategories(
    faqSearch,
    selectedFaqCategory
  );
  const visibleFaqCount = visibleFaqCategories.reduce(
    (count, category) => count + category.questions.length,
    0
  );

  useEffect(() => {
    if (showFaq) {
      messagesContainerRef.current?.scrollTo({ top: 0 });
      return;
    }

    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, showFaq]);

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
        siteSettings,
        resortRules,
        paymentQrCodes
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
          Kasa Ilaya Assistant
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
        <div className="fixed inset-x-3 bottom-20 z-50 flex h-[min(82dvh,680px)] max-h-[calc(100dvh-6rem)] flex-col overflow-hidden rounded-lg border border-border bg-card shadow-2xl sm:inset-x-auto sm:bottom-24 sm:right-6 sm:h-[600px] sm:w-[420px] sm:max-w-[calc(100vw-48px)]">
          {/* Header */}
          <div className="bg-primary text-primary-foreground px-4 py-3 flex items-center gap-3">
            <TreePalm className="h-5 w-5" />

            <div>
              <p className="text-base font-semibold">
                Kasa Ilaya Assistant
              </p>
              <p className="text-sm opacity-90">
                {showFaq ? "Frequently Asked Questions" : "Answers & support"}
              </p>
            </div>
          </div>

          {/* Messages */}
          <div
            ref={messagesContainerRef}
            className="flex-1 space-y-4 overflow-y-auto p-5"
            role="log"
            aria-live="polite"
            aria-relevant="additions"
          >
            {!showFaq && (
              <button
                type="button"
                className="inline-flex min-h-12 items-center gap-2 rounded-md border border-border bg-background px-4 text-base font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => setShowFaq(true)}
                disabled={loading}
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Back to FAQ
              </button>
            )}

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
                  className={`min-w-0 max-w-[92%] break-words rounded-lg px-4 py-3 text-base leading-7 [overflow-wrap:anywhere] ${
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
                      className="max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_h3]:mb-3 [&_h3]:text-base [&_h3]:font-semibold [&_li]:my-2 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6"
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

            {showFaq && (
              <section className="space-y-5 pt-2" aria-labelledby="chatbot-faq-title">
                <div>
                  <h3 id="chatbot-faq-title" className="text-lg font-semibold text-foreground">
                    Frequently Asked Questions
                  </h3>
                  <p className="mt-1 text-base leading-6 text-muted-foreground">
                    Search a question or choose a category.
                  </p>
                </div>

                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <label className="sr-only" htmlFor="chatbot-faq-search">
                    Search frequently asked questions
                  </label>
                  <input
                    id="chatbot-faq-search"
                    type="search"
                    value={faqSearch}
                    onChange={(event) => setFaqSearch(event.target.value)}
                    placeholder="Search questions"
                    className="h-12 w-full rounded-md border border-input bg-background pl-10 pr-3 text-base text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>

                {!normalizedFaqSearch && (
                  <div className="space-y-2">
                    <label htmlFor="chatbot-faq-category" className="block text-base font-semibold text-foreground">
                      Choose a category
                    </label>
                    <select
                      id="chatbot-faq-category"
                      value={selectedFaqCategory}
                      onChange={(event) => setSelectedFaqCategory(event.target.value)}
                      className="h-12 w-full rounded-md border border-input bg-background px-3 text-base font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {FAQ_CATEGORIES.map((category) => (
                        <option key={category.title} value={category.title}>
                          {category.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {normalizedFaqSearch && (
                  <p className="text-base text-foreground" aria-live="polite">
                    {visibleFaqCount} {visibleFaqCount === 1 ? "question" : "questions"} found
                  </p>
                )}

                {visibleFaqCategories.length > 0 ? (
                  <div className="space-y-3">
                    {visibleFaqCategories.map((category) => (
                      <div key={category.title} className="overflow-hidden rounded-md border border-border bg-background">
                        <h4 className="border-b border-border bg-muted/40 px-4 py-3 text-base font-semibold text-foreground">
                          {category.title}
                        </h4>
                        <div className="divide-y divide-border/70">
                          {category.questions.map((question) => (
                            <button
                              key={question}
                              type="button"
                              className="min-h-14 w-full px-4 py-3 text-left text-base leading-6 text-foreground transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                              onClick={() => {
                                setFaqSearch("");
                                setShowFaq(false);
                                processMessage(question);
                              }}
                            >
                              {question}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-base leading-6 text-foreground">
                    No matching questions. Try a different search.
                  </p>
                )}
              </section>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>
      )}
    </>
  );
}
