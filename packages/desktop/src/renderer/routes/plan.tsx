import { ErrorBoundary } from '@/components/ErrorBoundary';
import { GenerationOutput } from '@/components/GenerationOutput';
import { PlanCreator } from '@/components/PlanCreator';
import { useNotifications } from '@/hooks/useNotifications';
import { useTasks } from '@/hooks/useTasks';
import { api } from '@/lib/api';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState } from 'react';

export const Route = createFileRoute('/plan')({
  component: PlanPage,
});

function PlanPage() {
  const navigate = useNavigate();
  const { success, error } = useNotifications();
  const { loadTasks } = useTasks();
  const [planStreamOutput, setPlanStreamOutput] = useState('');
  const [isPlanGenerating, setIsPlanGenerating] = useState(false);
  const isPlanGeneratingRef = useRef(false);

  const resetPlanStream = useCallback(() => {
    setPlanStreamOutput('');
  }, []);

  useEffect(() => {
    const onOutput = api.agent.onOutput((chunk) => {
      if (!isPlanGeneratingRef.current) {
        return;
      }

      setPlanStreamOutput((prev) => `${prev}${chunk}`);
    });

    const finish = () => {
      if (!isPlanGeneratingRef.current) {
        return;
      }

      isPlanGeneratingRef.current = false;
      setIsPlanGenerating(false);
      loadTasks().catch(() => {
        return;
      });
    };

    const onComplete = api.agent.onComplete(() => {
      finish();
      success({ title: 'Plan generation finished' });
    });

    const onStopped = api.agent.onStopped(() => {
      finish();
    });

    const onVerifyFailed = api.agent.onVerifyFailed((message) => {
      if (!isPlanGeneratingRef.current) {
        return;
      }

      isPlanGeneratingRef.current = false;
      setIsPlanGenerating(false);
      error({ title: 'Plan generation failed', description: message });
    });

    return () => {
      onOutput();
      onComplete();
      onStopped();
      onVerifyFailed();
    };
  }, [error, loadTasks, success]);

  return (
    <ErrorBoundary title="Plan view error">
      <div className="grid h-full gap-3 lg:grid-cols-[1.25fr_0.75fr]">
        <PlanCreator
          isGenerating={isPlanGenerating}
          isGeneratingRef={isPlanGeneratingRef}
          setIsGenerating={setIsPlanGenerating}
          setStreamOutput={setPlanStreamOutput}
          resetStream={resetPlanStream}
        />
        <GenerationOutput
          streamOutput={planStreamOutput}
          isGenerating={isPlanGenerating}
          onOpenTaskBoard={() => {
            navigate({ to: '/tasks' });
          }}
        />
      </div>
    </ErrorBoundary>
  );
}
