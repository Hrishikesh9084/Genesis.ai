import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

const TOUR_STEPS = [
  {
    title: "Welcome to Genesis.ai",
    description:
      "This short tour will show you where to build, manage, and deploy your projects.",
    path: "/dashboard",
  },
  {
    title: "Create New Projects",
    description:
      "Use New Project to generate full-stack apps quickly with AI and then customize the code.",
    path: "/new-project",
  },
  {
    title: "Connect Domains",
    description:
      "Open Domains to attach custom domains and manage DNS for your deployed apps.",
    path: "/domains",
  },
  {
    title: "Edit and Preview",
    description:
      "Open any project to edit files side-by-side and see a live browser preview before deploy.",
    path: "/dashboard",
  },
];

export default function AppTour({ open, onComplete }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [stepIndex, setStepIndex] = useState(0);

  const isLastStep = stepIndex === TOUR_STEPS.length - 1;
  const step = TOUR_STEPS[stepIndex];

  const progressPercent = useMemo(() => {
    return Math.round(((stepIndex + 1) / TOUR_STEPS.length) * 100);
  }, [stepIndex]);

  const moveToStep = (nextIndex) => {
    const bounded = Math.max(0, Math.min(nextIndex, TOUR_STEPS.length - 1));
    const nextStep = TOUR_STEPS[bounded];
    if (nextStep?.path && location.pathname !== nextStep.path) {
      navigate(nextStep.path);
    }
    setStepIndex(bounded);
  };

  useEffect(() => {
    if (!open) return;
    setStepIndex(0);

    if (TOUR_STEPS[0]?.path && location.pathname !== TOUR_STEPS[0].path) {
      navigate(TOUR_STEPS[0].path);
    }
  }, [open, location.pathname, navigate]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        onComplete();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onComplete]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-80 flex items-center justify-center bg-black/75 px-4">
      <div className="w-full max-w-xl rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-800 px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-orange-400">Application Tour</p>
            <h2 className="mt-1 text-lg font-semibold text-white">{step.title}</h2>
          </div>
          <button
            type="button"
            onClick={onComplete}
            className="rounded-md p-1.5 text-gray-400 transition hover:bg-gray-800 hover:text-white"
            title="Close tour"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4">
          <p className="text-sm leading-6 text-gray-300">{step.description}</p>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between text-xs text-gray-400">
              <span>
                Step {stepIndex + 1} of {TOUR_STEPS.length}
              </span>
              <span>{progressPercent}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-gray-800">
              <div
                className="h-full rounded-full bg-orange-500 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-gray-800 px-5 py-4">
          <button
            type="button"
            onClick={onComplete}
            className="text-sm text-gray-400 transition hover:text-gray-200"
          >
            Skip tour
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => moveToStep(stepIndex - 1)}
              disabled={stepIndex === 0}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-200 transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>

            <button
              type="button"
              onClick={() => {
                if (isLastStep) {
                  onComplete();
                  return;
                }
                moveToStep(stepIndex + 1);
              }}
              className="inline-flex items-center gap-1 rounded-lg bg-orange-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-orange-600"
            >
              {isLastStep ? "Finish" : "Next"}
              {!isLastStep && <ChevronRight className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}