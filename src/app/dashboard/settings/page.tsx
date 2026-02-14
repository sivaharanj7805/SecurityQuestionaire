"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import { Check } from "lucide-react";

interface PlanDetails {
  id: string;
  name: string;
  price: number;
  limits: {
    questionnaires: number;
    pages: number;
    seats: number;
  };
  stripePriceId: string | null;
}

interface BillingData {
  plan: PlanDetails;
  usage: {
    questionnaires: number;
    pages: number;
    seats: number;
  };
  subscription: {
    status: string;
    currentPeriodEnd: number;
    cancelAtPeriodEnd: boolean;
  } | null;
  plans: PlanDetails[];
}

function formatLimit(value: number): string {
  // Infinity gets serialized as null in JSON, handle both
  if (value === null || value === Infinity || value > 999999) return "Unlimited";
  return String(value);
}

function UsageBar({
  label,
  current,
  limit,
}: {
  label: string;
  current: number;
  limit: number;
}) {
  const isUnlimited = limit === null || limit === Infinity || limit > 999999;
  const pct = isUnlimited ? 0 : Math.min(100, Math.round((current / limit) * 100));

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="text-muted-foreground">
          {current} / {formatLimit(limit)}
        </span>
      </div>
      {!isUnlimited && <Progress value={pct} className="h-2" />}
    </div>
  );
}

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get("tab") ?? "general";
  const { toast } = useToast();

  const [billing, setBilling] = useState<BillingData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchBilling = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/billing");
      if (res.ok) {
        setBilling(await res.json());
      }
    } catch {
      // billing might not be configured yet
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBilling();
  }, [fetchBilling]);

  useEffect(() => {
    if (searchParams.get("success") === "true") {
      toast({ title: "Subscription activated successfully!" });
      fetchBilling();
    }
    if (searchParams.get("canceled") === "true") {
      toast({ title: "Checkout canceled", variant: "destructive" });
    }
  }, [searchParams, toast, fetchBilling]);

  async function handleCheckout(priceId: string) {
    setActionLoading(priceId);
    try {
      const res = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "checkout", priceId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast({
          title: "Error",
          description: data.error ?? "Failed to create checkout session.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to start checkout.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleManage() {
    setActionLoading("portal");
    try {
      const res = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "portal" }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast({
          title: "Error",
          description: data.error ?? "Failed to open billing portal.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to open billing portal.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your organization settings and preferences.
        </p>
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Organization</CardTitle>
              <CardDescription>
                Manage your organization details and preferences.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Organization settings will be available here.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>
                Invite and manage team members in your organization.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Team management will be available here.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing" className="space-y-4">
          {/* Current plan & usage */}
          <Card>
            <CardHeader>
              <CardTitle>Current Plan</CardTitle>
              <CardDescription>
                Your current subscription and resource usage.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Loading billing info...</p>
              ) : billing ? (
                <>
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl font-semibold">
                      {billing.plan.name}
                    </h3>
                    {billing.plan.price > 0 && (
                      <Badge variant="secondary">
                        ${billing.plan.price}/mo
                      </Badge>
                    )}
                    {billing.plan.id === "free" && (
                      <Badge variant="outline">Free</Badge>
                    )}
                  </div>

                  {billing.subscription && (
                    <p className="text-sm text-muted-foreground">
                      {billing.subscription.cancelAtPeriodEnd
                        ? "Cancels"
                        : "Renews"}{" "}
                      on{" "}
                      {new Date(
                        billing.subscription.currentPeriodEnd * 1000
                      ).toLocaleDateString()}
                    </p>
                  )}

                  <div className="space-y-3">
                    <UsageBar
                      label="Questionnaires"
                      current={billing.usage.questionnaires}
                      limit={billing.plan.limits.questionnaires}
                    />
                    <UsageBar
                      label="Document Pages"
                      current={billing.usage.pages}
                      limit={billing.plan.limits.pages}
                    />
                    <UsageBar
                      label="Team Seats"
                      current={billing.usage.seats}
                      limit={billing.plan.limits.seats}
                    />
                  </div>

                  {billing.subscription && (
                    <Button
                      variant="outline"
                      onClick={handleManage}
                      disabled={actionLoading === "portal"}
                    >
                      {actionLoading === "portal"
                        ? "Opening..."
                        : "Manage Subscription"}
                    </Button>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Unable to load billing information. Stripe may not be configured.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Plan comparison */}
          {billing && (
            <Card>
              <CardHeader>
                <CardTitle>Available Plans</CardTitle>
                <CardDescription>
                  Choose the plan that best fits your needs.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  {billing.plans
                    .filter((p) => p.id !== "free")
                    .map((plan) => {
                      const isCurrent = plan.id === billing.plan.id;
                      return (
                        <div
                          key={plan.id}
                          className={`rounded-lg border p-5 space-y-4 ${
                            isCurrent ? "border-primary bg-primary/5" : ""
                          }`}
                        >
                          <div>
                            <h4 className="font-semibold text-lg">
                              {plan.name}
                            </h4>
                            <p className="text-2xl font-bold mt-1">
                              ${plan.price}
                              <span className="text-sm font-normal text-muted-foreground">
                                /mo
                              </span>
                            </p>
                          </div>
                          <ul className="space-y-2 text-sm">
                            <li className="flex items-center gap-2">
                              <Check className="h-4 w-4 text-green-600" />
                              {formatLimit(plan.limits.questionnaires)}{" "}
                              questionnaires
                            </li>
                            <li className="flex items-center gap-2">
                              <Check className="h-4 w-4 text-green-600" />
                              {formatLimit(plan.limits.pages)} pages
                            </li>
                            <li className="flex items-center gap-2">
                              <Check className="h-4 w-4 text-green-600" />
                              {formatLimit(plan.limits.seats)} team seats
                            </li>
                          </ul>
                          {isCurrent ? (
                            <Button variant="outline" className="w-full" disabled>
                              Current Plan
                            </Button>
                          ) : plan.stripePriceId ? (
                            <Button
                              className="w-full"
                              onClick={() =>
                                handleCheckout(plan.stripePriceId!)
                              }
                              disabled={actionLoading === plan.stripePriceId}
                            >
                              {actionLoading === plan.stripePriceId
                                ? "Loading..."
                                : "Upgrade"}
                            </Button>
                          ) : (
                            <Button variant="outline" className="w-full" disabled>
                              Contact Sales
                            </Button>
                          )}
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Toaster />
    </div>
  );
}
