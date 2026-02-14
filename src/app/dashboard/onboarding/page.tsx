"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Check,
  ChevronRight,
  FileText,
  ClipboardList,
  MessageSquare,
  Rocket,
} from "lucide-react";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";

const STEPS = [
  {
    id: 1,
    title: "Welcome to SecureQuest",
    description: "Let's get your organization set up to answer security questionnaires 10x faster.",
    icon: Rocket,
  },
  {
    id: 2,
    title: "Upload Your First Document",
    description: "Upload security policies, SOC 2 reports, or compliance docs to build your knowledge base.",
    icon: FileText,
  },
  {
    id: 3,
    title: "Try a Sample Questionnaire",
    description: "See how AI generates answers from your knowledge base with a sample questionnaire.",
    icon: ClipboardList,
  },
  {
    id: 4,
    title: "Review AI Answers",
    description: "Review, edit, and approve AI-generated answers. Save great answers to your library.",
    icon: MessageSquare,
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSeeding, setIsSeeding] = useState(false);

  async function handleSeedDemo() {
    setIsSeeding(true);
    try {
      const res = await fetch("/api/demo/seed", { method: "POST" });
      if (res.ok) {
        toast({ title: "Sample data created! Explore your knowledge base and questionnaires." });
        setCurrentStep(4);
      } else {
        const data = await res.json();
        toast({
          title: "Error",
          description: data.error ?? "Failed to create sample data.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to create sample data.",
        variant: "destructive",
      });
    } finally {
      setIsSeeding(false);
    }
  }

  function handleNext() {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  }

  function handleFinish() {
    router.push("/dashboard");
  }

  function goToKnowledgeBase() {
    router.push("/dashboard/knowledge-base");
  }

  function goToQuestionnaires() {
    router.push("/dashboard/questionnaires");
  }

  const step = STEPS[currentStep - 1];
  const StepIcon = step.icon;

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
      {/* Progress indicator */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s) => (
          <div key={s.id} className="flex items-center">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                s.id < currentStep
                  ? "bg-primary text-primary-foreground"
                  : s.id === currentStep
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {s.id < currentStep ? (
                <Check className="h-4 w-4" />
              ) : (
                s.id
              )}
            </div>
            {s.id < STEPS.length && (
              <div
                className={`h-0.5 w-8 mx-1 ${
                  s.id < currentStep ? "bg-primary" : "bg-muted"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <StepIcon className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">{step.title}</CardTitle>
          <CardDescription className="text-base">
            {step.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {currentStep === 1 && (
            <div className="space-y-3">
              <Button className="w-full" onClick={handleNext}>
                Get Started
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleSeedDemo}
                disabled={isSeeding}
              >
                {isSeeding ? "Creating sample data..." : "Try with Sample Data"}
              </Button>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-3">
              <Button className="w-full" onClick={goToKnowledgeBase}>
                Upload a Document
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
              <Button variant="outline" className="w-full" onClick={handleNext}>
                Skip for Now
              </Button>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-3">
              <Button className="w-full" onClick={goToQuestionnaires}>
                Import a Questionnaire
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleSeedDemo}
                disabled={isSeeding}
              >
                {isSeeding ? "Creating..." : "Use Sample Questionnaire"}
              </Button>
              <Button variant="ghost" className="w-full" onClick={handleNext}>
                Skip for Now
              </Button>
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-3">
              <Button className="w-full" onClick={handleFinish}>
                Go to Dashboard
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
              <Button variant="outline" className="w-full" onClick={goToQuestionnaires}>
                Review Questionnaires
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Toaster />
    </div>
  );
}
