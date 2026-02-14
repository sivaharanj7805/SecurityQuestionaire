import Link from "next/link";
import { Brain, BookOpen, Download, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const features = [
  {
    title: "AI Drafting",
    description:
      "Upload your security docs and let AI draft accurate answers to questionnaire questions in seconds.",
    icon: Brain,
  },
  {
    title: "Answer Library",
    description:
      "Build a reusable library of approved answers. AI learns from your past responses to improve over time.",
    icon: BookOpen,
  },
  {
    title: "One-Click Export",
    description:
      "Export completed questionnaires back to their original format — Excel, PDF, or Word — with one click.",
    icon: Download,
  },
];

const plans = [
  {
    name: "Starter",
    price: "$199",
    description: "For small teams getting started",
    features: [
      "50 documents",
      "10 questionnaires/mo",
      "500 AI answers/mo",
      "3 team members",
      "Email support",
    ],
  },
  {
    name: "Growth",
    price: "$499",
    description: "For growing security teams",
    popular: true,
    features: [
      "200 documents",
      "50 questionnaires/mo",
      "2,000 AI answers/mo",
      "10 team members",
      "Priority support",
      "Answer library",
    ],
  },
  {
    name: "Scale",
    price: "$799",
    description: "For enterprise organizations",
    features: [
      "Unlimited documents",
      "Unlimited questionnaires",
      "Unlimited AI answers",
      "Unlimited team members",
      "Dedicated support",
      "Custom integrations",
      "SSO / SAML",
    ],
  },
];

export default function LandingPage() {
  return (
    <div>
      {/* Hero */}
      <section className="container mx-auto px-4 py-24 text-center">
        <h1 className="mx-auto max-w-4xl text-5xl font-bold tracking-tight sm:text-6xl">
          Answer Security Questionnaires{" "}
          <span className="text-primary">10x Faster</span> with AI
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Upload your security documentation, import questionnaires, and let AI
          draft accurate responses. Review, approve, and export — all in one
          place.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link href="/sign-up">
            <Button size="lg">Get Started Free</Button>
          </Link>
          <Link href="#pricing">
            <Button variant="outline" size="lg">
              View Pricing
            </Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-center text-3xl font-bold tracking-tight">
          How It Works
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">
          Three simple steps to transform your security questionnaire workflow.
        </p>
        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {features.map((feature) => (
            <Card key={feature.title} className="text-center">
              <CardHeader>
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="mt-4">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="container mx-auto px-4 py-16">
        <h2 className="text-center text-3xl font-bold tracking-tight">
          Simple, Transparent Pricing
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">
          Choose the plan that fits your team. All plans include a 14-day free
          trial.
        </p>
        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={
                plan.popular ? "border-primary shadow-lg" : undefined
              }
            >
              <CardHeader>
                {plan.popular && (
                  <Badge className="w-fit">Most Popular</Badge>
                )}
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground">/mo</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Link href="/sign-up" className="w-full">
                  <Button
                    className="w-full"
                    variant={plan.popular ? "default" : "outline"}
                  >
                    Start Free Trial
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t bg-muted/50 py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold tracking-tight">
            Ready to speed up your questionnaire workflow?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Join teams that answer security questionnaires in hours, not weeks.
          </p>
          <Link href="/sign-up">
            <Button size="lg" className="mt-8">
              Get Started Free
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
