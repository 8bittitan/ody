import { ErrorBoundary } from '@/components/ErrorBoundary';
import { GenerationOutput } from '@/components/GenerationOutput';
import { PlanCreator } from '@/components/PlanCreator';
import { usePlanAgent } from '@/hooks/useAgent';
import { useNotifications } from '@/hooks/useNotifications';
import { useProjects } from '@/hooks/useProjects';
import { useTasks } from '@/hooks/useTasks';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useRef } from 'react';

export const Route = createFileRoute('/plan')({
  component: PlanPage,
});

function PlanPage() {
  const navigate = useNavigate();
  const { success, error } = useNotifications();
  const { activeProjectPath } = useProjects();
  const { loadTasks } = useTasks();
  const {
    outputHtmlChunks: planOutputHtmlChunks,
    isRunning: isPlanGenerating,
    isComplete,
    error: planError,
    clearOutput,
  } = usePlanAgent(activeProjectPath);
  const isPlanGeneratingRef = useRef(false);

  const resetPlanStream = useCallback(() => {
    clearOutput();
  }, [clearOutput]);

  useEffect(() => {
    if (isPlanGenerating) {
      isPlanGeneratingRef.current = true;
      return;
    }

    if (!isPlanGeneratingRef.current) {
      return;
    }

    isPlanGeneratingRef.current = false;
    loadTasks().catch(() => {
      return;
    });

    if (isComplete) {
      success({ title: 'Plan generation finished' });
    }
  }, [isComplete, isPlanGenerating, loadTasks, success]);

  useEffect(() => {
    if (planError && isPlanGeneratingRef.current) {
      error({ title: 'Plan generation failed', description: planError });
    }
  }, [error, isPlanGenerating, planError]);

  return (
    <ErrorBoundary title="Plan view error">
      <div className="grid h-full gap-3 lg:grid-cols-[1.25fr_0.75fr]">
        <PlanCreator isGenerating={isPlanGenerating} resetStream={resetPlanStream} />
        <GenerationOutput
          outputHtmlChunks={planOutputHtmlChunks}
          isGenerating={isPlanGenerating}
          onOpenTaskBoard={() => {
            navigate({ to: '/tasks' });
          }}
        />
      </div>
    </ErrorBoundary>
  );
}
