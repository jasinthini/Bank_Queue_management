import { Link } from "react-router-dom";
import {
  ArrowRight,
  Banknote,
  CreditCard,
  Landmark,
  Ticket,
  Monitor,
  UsersRound,
} from "lucide-react";
import { AppShell } from "../components/AppShell.jsx";
import lobby from "../assets/bank-lobby.jpg";

const services = [
  {
    icon: Banknote,
    title: "Cash Deposit",
    description: "Take a queue ticket for your cash deposit.",
  },
  {
    icon: CreditCard,
    title: "Cash Withdrawal",
    description: "Join the queue for cash withdrawal services.",
  },
];

const steps = [
  {
    icon: Landmark,
    title: "Choose your branch",
    description: "Select the branch you are visiting.",
  },
  {
    icon: Ticket,
    title: "Get your ticket",
    description: "Choose an available service and create your token.",
  },
  {
    icon: Monitor,
    title: "Follow your turn",
    description: "Check the Live Board and proceed when called.",
  },
];

export default function Home() {
  return (
    <AppShell title="Home">
      {/* Bank image and welcome */}
      <section className="relative overflow-hidden rounded-lg border border-border">
        <img
          src={lobby}
          alt="Aureum Bank lobby and customer counters"
          className="absolute inset-0 h-full w-full object-cover"
        />

        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/65 to-black/15" />

        <div className="relative flex min-h-[460px] flex-col justify-center px-7 py-12 sm:min-h-[520px] sm:px-12">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-primary">
            <Landmark className="size-5" />
            Welcome to Aureum Bank
          </p>

          <h1 className="mt-6 max-w-2xl font-display text-4xl leading-tight text-white sm:text-6xl">
            Banking that moves
            <span className="block text-primary">
              with you.
            </span>
          </h1>

          <p className="mt-6 max-w-lg text-base leading-relaxed text-white/80">
            Take your queue ticket and follow your turn.
            Spend less time standing in line and arrive at
            your counter when called.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/get-ticket"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 font-semibold text-primary-foreground transition hover:opacity-90"
            >
              Get a ticket
              <ArrowRight className="size-5" />
            </Link>

            <Link
              to="/board"
              className="inline-flex items-center gap-2 rounded-md border border-primary/60 bg-black/30 px-6 py-3 font-semibold text-white transition hover:bg-black/50"
            >
              <Monitor className="size-5" />
              Live Board
            </Link>
          </div>
        </div>
      </section>

      {/* Introduction */}
      <section className="grid gap-5 border-b border-border py-8 sm:grid-cols-3">
        {[
          ["Virtual queue", "Take a ticket for your visit"],
          ["Multiple counters", "Follow your assigned counter"],
          ["Live status", "See waiting and serving tokens"],
        ].map(([title, description]) => (
          <div key={title} className="rounded-md bg-card p-5">
            <p className="font-semibold text-primary">
              {title}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {description}
            </p>
          </div>
        ))}
      </section>

      {/* Banking services */}
      <section className="py-10">
        <p className="text-xs font-bold uppercase tracking-widest text-primary">
          Banking services
        </p>

        <h2 className="mt-3 font-display text-3xl sm:text-4xl">
          What brings you in today?
        </h2>

        <p className="mt-3 text-sm text-muted-foreground">
          Available services depend on your selected branch.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {services.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="rounded-lg border border-border bg-card p-6"
            >
              <Icon className="size-8 text-primary" />

              <h3 className="mt-5 text-xl font-semibold">
                {title}
              </h3>

              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {description}
              </p>

              <Link
                to="/get-ticket"
                className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary"
              >
                Choose branch and service
                <ArrowRight className="size-4" />
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-border py-10">
        <p className="text-xs font-bold uppercase tracking-widest text-primary">
          Your next visit
        </p>

        <h2 className="mt-3 font-display text-3xl">
          Get started in three steps
        </h2>

        <div className="mt-7 grid gap-5 md:grid-cols-3">
          {steps.map(({ icon: Icon, title, description }, index) => (
            <div
              key={title}
              className="rounded-lg border border-border bg-card p-6"
            >
              <div className="flex items-center justify-between">
                <Icon className="size-7 text-primary" />

                <span className="font-token text-2xl text-primary">
                  0{index + 1}
                </span>
              </div>

              <h3 className="mt-5 text-lg font-semibold">
                {title}
              </h3>

              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Final ticket link */}
      <section className="mb-6 flex flex-col justify-between gap-6 rounded-lg border border-primary/30 bg-card p-7 sm:flex-row sm:items-center sm:p-9">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-primary">
            <UsersRound className="size-5" />
            Your branch. Your turn.
          </p>

          <h2 className="mt-3 font-display text-2xl sm:text-3xl">
            Ready for your banking visit?
          </h2>

          <p className="mt-3 text-sm text-muted-foreground">
            Sign in and take a ticket for your selected service.
          </p>
        </div>

        <Link
          to="/get-ticket"
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 font-semibold text-primary-foreground transition hover:opacity-90"
        >
          Create ticket
          <ArrowRight className="size-5" />
        </Link>
      </section>
    </AppShell>
  );
}