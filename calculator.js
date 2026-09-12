/**
 * Payoff Lab — Canadian mortgage payoff calculator
 * Residential mortgages in Canada typically compound semi-annually.
 * Periodic rate for m payments/year: (1 + r/2)^(2/m) - 1
 */
(function () {
  "use strict";

  const CAD = new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  });

  const MAX_PERIODS = 1200; // months-equivalent safety (biweekly uses more steps)
  const CENTS = 100;

  function roundCents(n) {
    return Math.round((n + Number.EPSILON) * CENTS) / CENTS;
  }

  function parseNumber(raw) {
    if (raw == null) return NaN;
    const t = String(raw).replace(/[$,\s]/g, "").trim();
    if (t === "") return NaN;
    return Number(t);
  }

  /** Canadian equivalent rate for m payments per year (semi-annual compounding). */
  function periodicRate(annualNominalDecimal, paymentsPerYear) {
    const r = annualNominalDecimal;
    if (Math.abs(r) < 1e-15) return 0;
    return Math.pow(1 + r / 2, 2 / paymentsPerYear) - 1;
  }

  /** Standard amortization payment for principal over n periods at rate i. */
  function amortPayment(principal, i, n) {
    if (n <= 0) return 0;
    if (Math.abs(i) < 1e-15) return roundCents(principal / n);
    const factor = Math.pow(1 + i, n);
    return roundCents((principal * (i * factor)) / (factor - 1));
  }

  function formatPayoffDuration(totalPeriods, paymentsPerYear) {
    const years = Math.floor(totalPeriods / paymentsPerYear);
    const rem = totalPeriods % paymentsPerYear;
    // Express remainder as whole months when monthly; otherwise as periods
    if (paymentsPerYear === 12) {
      const parts = [];
      if (years > 0) parts.push(years === 1 ? "1 year" : `${years} years`);
      if (rem > 0) parts.push(rem === 1 ? "1 month" : `${rem} months`);
      return parts.length ? parts.join(", ") : "0 months";
    }
    // Biweekly: convert periods → years + months approx for readability
    const totalMonthsApprox = Math.round((totalPeriods / paymentsPerYear) * 12);
    const y = Math.floor(totalMonthsApprox / 12);
    const m = totalMonthsApprox % 12;
    const parts = [];
    if (y > 0) parts.push(y === 1 ? "1 year" : `${y} years`);
    if (m > 0) parts.push(m === 1 ? "1 month" : `${m} months`);
    return parts.length ? parts.join(", ") : "0 months";
  }

  function addPeriodsToDate(start, periods, paymentsPerYear) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    if (paymentsPerYear === 12) {
      d.setMonth(d.getMonth() + periods);
    } else {
      // biweekly ≈ 14 days
      d.setDate(d.getDate() + periods * 14);
    }
    return d;
  }

  function formatDate(d) {
    return new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(d);
  }

  /**
   * Simulate amortization with optional extra per period.
   * Caps final payment; stops when balance cleared; maxPeriods safety.
   */
  function simulate(principal, i, scheduledPayment, extraPerPeriod, maxPeriods) {
    let balance = roundCents(principal);
    let totalInterest = 0;
    let periods = 0;
    const payment = roundCents(scheduledPayment + extraPerPeriod);

    while (balance > 0 && periods < maxPeriods) {
      const interest = roundCents(balance * i);
      const due = roundCents(balance + interest);
      const applied = Math.min(payment, due);
      const interestPortion = Math.min(interest, applied);
      const principalPortion = roundCents(applied - interestPortion);

      if (principalPortion <= 0 && balance > 0) {
        return { error: "cover_interest", periods, totalInterest: Infinity };
      }

      totalInterest = roundCents(totalInterest + interestPortion);
      balance = roundCents(balance - principalPortion);
      if (balance < 0.005) balance = 0;
      periods += 1;
    }

    if (balance > 0) {
      return { error: "max_periods", periods, totalInterest };
    }

    return { periods, totalInterest };
  }

  function validate(inputs) {
    const { principal, annualRatePercent, years, extraMonthly } = inputs;
    if (!Number.isFinite(principal) || principal <= 0) {
      return "Enter a mortgage balance greater than zero.";
    }
    if (principal > 100_000_000) {
      return "Enter a mortgage balance up to $100,000,000.";
    }
    if (!Number.isFinite(annualRatePercent) || annualRatePercent < 0) {
      return "Enter an annual interest rate of 0 or more.";
    }
    if (annualRatePercent > 100) {
      return "Enter an annual interest rate of 100% or less.";
    }
    if (!Number.isFinite(years) || years <= 0) {
      return "Enter an amortization of more than zero years.";
    }
    if (years > 50) {
      return "Enter an amortization of 50 years or less.";
    }
    if (!Number.isFinite(extraMonthly) || extraMonthly < 0) {
      return "Extra monthly payment cannot be negative.";
    }
    return null;
  }

  /**
   * @param {{ principal, annualRatePercent, years, extraMonthly, frequency }} inputs
   * frequency: 'monthly' | 'biweekly' | 'accelerated'
   */
  function calculate(inputs) {
    const err = validate(inputs);
    if (err) return { error: err };

    const principal = roundCents(inputs.principal);
    const r = inputs.annualRatePercent / 100;
    const years = inputs.years;
    const extraMonthly = roundCents(inputs.extraMonthly || 0);
    const frequency = inputs.frequency || "monthly";

    // Always compute Canadian monthly payment as the baseline schedule
    const monthlyRate = periodicRate(r, 12);
    const monthlyPeriods = Math.round(years * 12);
    const monthlyPayment = amortPayment(principal, monthlyRate, monthlyPeriods);

    let paymentsPerYear;
    let scheduledPayment;
    let extraPerPeriod;
    let maxPeriods;

    if (frequency === "monthly") {
      paymentsPerYear = 12;
      scheduledPayment = monthlyPayment;
      extraPerPeriod = extraMonthly;
      maxPeriods = Math.max(monthlyPeriods * 2, MAX_PERIODS);
    } else if (frequency === "biweekly") {
      // Standard Canadian biweekly: monthly × 12 / 26
      paymentsPerYear = 26;
      scheduledPayment = roundCents((monthlyPayment * 12) / 26);
      extraPerPeriod = roundCents((extraMonthly * 12) / 26);
      maxPeriods = Math.max(Math.round(years * 26) * 2, 2600);
    } else {
      // Accelerated biweekly: half the monthly payment, 26×/year
      paymentsPerYear = 26;
      scheduledPayment = roundCents(monthlyPayment / 2);
      extraPerPeriod = roundCents((extraMonthly * 12) / 26);
      maxPeriods = Math.max(Math.round(years * 26) * 2, 2600);
    }

    const i = periodicRate(r, paymentsPerYear);

    // Baseline (no extra): for standard monthly/biweekly use contractual term interest;
    // accelerated always needs simulation (pays off early). Cent-rounding on the
    // contractual payment can otherwise show +1 phantom period.
    let baseline;
    if (frequency === "accelerated") {
      baseline = simulate(principal, i, scheduledPayment, 0, maxPeriods);
    } else if (frequency === "monthly") {
      baseline = {
        periods: monthlyPeriods,
        totalInterest: Math.max(0, roundCents(scheduledPayment * monthlyPeriods - principal)),
      };
    } else {
      // Standard biweekly: same total annual outlay as monthly → same interest over term
      const biPeriods = Math.round(years * 26);
      baseline = {
        periods: biPeriods,
        totalInterest: Math.max(0, roundCents(scheduledPayment * biPeriods - principal)),
      };
    }

    if (baseline.error === "cover_interest") {
      return {
        error:
          "This payment does not cover the interest. Lower the rate or check your inputs.",
      };
    }

    const withExtra =
      extraPerPeriod > 0 || frequency === "accelerated"
        ? simulate(principal, i, scheduledPayment, extraPerPeriod, maxPeriods)
        : baseline;

    if (withExtra.error === "cover_interest") {
      return {
        error:
          "This payment does not cover the interest. Increase the extra payment or lower the rate.",
      };
    }

    const interestSaved = roundCents(
      Math.max(0, baseline.totalInterest - withExtra.totalInterest)
    );
    const periodsSaved = Math.max(0, baseline.periods - withExtra.periods);

    // Months saved (calendar) for display
    const monthsSaved = Math.round((periodsSaved / paymentsPerYear) * 12);

    const now = new Date();
    const payoffDate = addPeriodsToDate(now, withExtra.periods, paymentsPerYear);

    const paymentLabel =
      frequency === "monthly"
        ? "Monthly payment"
        : frequency === "biweekly"
          ? "Biweekly payment"
          : "Accelerated biweekly payment";

    return {
      paymentLabel,
      scheduledPayment,
      monthlyPaymentEquivalent: monthlyPayment,
      totalInterest: withExtra.totalInterest,
      baselineInterest: baseline.totalInterest,
      interestSaved,
      periods: withExtra.periods,
      baselinePeriods: baseline.periods,
      periodsSaved,
      monthsSaved,
      payoffDuration: formatPayoffDuration(withExtra.periods, paymentsPerYear),
      payoffDate: formatDate(payoffDate),
      extraMonthly,
      extraPerPeriod,
      frequency,
      paymentsPerYear,
    };
  }

  // Expose for tests / embedding
  window.PayoffLab = { calculate, parseNumber, periodicRate, amortPayment, roundCents };

  // ——— DOM ———
  const form = document.getElementById("calc-form");
  if (!form) return;

  const els = {
    principal: document.getElementById("principal"),
    rate: document.getElementById("rate"),
    years: document.getElementById("years"),
    extra: document.getElementById("extra"),
    frequency: document.getElementById("frequency"),
    error: document.getElementById("form-error"),
    results: document.getElementById("results-body"),
  };

  function readInputs() {
    return {
      principal: parseNumber(els.principal.value),
      annualRatePercent: parseNumber(els.rate.value),
      years: parseNumber(els.years.value),
      extraMonthly: els.extra.value.trim() === "" ? 0 : parseNumber(els.extra.value),
      frequency: els.frequency.value,
    };
  }

  function showError(msg) {
    els.error.textContent = msg || "";
    els.error.classList.toggle("visible", Boolean(msg));
  }

  function render(result) {
    if (result.error) {
      showError(result.error);
      els.results.innerHTML =
        `<p class="results-placeholder">Fix the inputs above, then calculate again.</p>`;
      return;
    }
    showError(null);

    const extraNote =
      result.extraMonthly > 0
        ? `<span class="metric-sub">Plus ${CAD.format(result.extraMonthly)} extra / month</span>`
        : "";

    let savingsHtml = "";
    if (result.extraMonthly > 0 && (result.interestSaved > 0 || result.monthsSaved > 0)) {
      savingsHtml = `
        <div class="savings">
          <h3>With extra payments</h3>
          <div class="savings-grid">
            <div>
              <span class="metric-label">Interest saved</span>
              <div class="metric-value">${CAD.format(result.interestSaved)}</div>
            </div>
            <div>
              <span class="metric-label">Time saved</span>
              <div class="metric-value">${result.monthsSaved} mo</div>
            </div>
          </div>
        </div>`;
    }

    els.results.innerHTML = `
      <div class="metrics">
        <div class="metric">
          <span class="metric-label">${result.paymentLabel}</span>
          <div class="metric-value">${CAD.format(result.scheduledPayment)}</div>
          ${extraNote}
        </div>
        <div class="metric">
          <span class="metric-label">Total interest</span>
          <div class="metric-value">${CAD.format(result.totalInterest)}</div>
        </div>
        <div class="metric">
          <span class="metric-label">Payoff time</span>
          <div class="metric-value">${result.payoffDuration}</div>
          <span class="metric-sub">Approx. ${result.payoffDate}</span>
        </div>
      </div>
      ${savingsHtml}`;
  }

  function run() {
    render(calculate(readInputs()));
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    run();
  });

  // Live recalculate on input change (debounced lightly via requestAnimationFrame)
  let raf = null;
  function onChange() {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(run);
  }

  ["input", "change"].forEach((evt) => {
    form.addEventListener(evt, onChange);
  });

  // Initial calculate with defaults
  run();

})();
