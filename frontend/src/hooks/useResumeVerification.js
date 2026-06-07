import { useCallback, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  parseResumeAndTriggerVerification,
  fetchMultiProjectAnalysis,
} from '../services/recruiterApi';

/**
 * Drives the "upload -> parse -> auto GitHub verification" flow.
 *
 * On success the backend has already (a) parsed the resume into structured
 * candidate data and (b) fired off GitHub verification if a profile/repo was
 * found — so callers just need the parsed payload to render the staged UI and
 * to know the candidateId to start polling `useMultiProjectAnalysis` with.
 */
export function useResumeUpload({ onSuccess } = {})
{
  const [progress, setProgress] = useState(0);
  const abortRef = useRef(null);

  const mutation = useMutation({
    mutationKey: ['resume-upload'],
    mutationFn: async (file) => {
      setProgress(0);
      const controller = new AbortController();
      abortRef.current = controller;
      return parseResumeAndTriggerVerification(file, {
        signal: controller.signal,
        onUploadProgress: (evt) => {
          if (evt.total) setProgress(Math.round((evt.loaded / evt.total) * 100));
        },
      });
    },
    retry: 1,
    onSuccess: (data) => {
      setProgress(100);
      onSuccess?.(data);
    },
    onSettled: () => {
      abortRef.current = null;
    },
  });

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    mutation.reset();
    setProgress(0);
  }, [mutation]);

  return {
    upload: mutation.mutate,
    uploadAsync: mutation.mutateAsync,
    retry: () => mutation.variables && mutation.mutate(mutation.variables),
    cancel,
    reset: mutation.reset,
    data: mutation.data,
    error: mutation.error,
    isUploading: mutation.isPending,
    isError: mutation.isError,
    isSuccess: mutation.isSuccess,
    progress,
  };
}

const TERMINAL_STATUSES = ['completed', 'failed', 'error'];

/**
 * Polls the multi-project GitHub verification status for a candidate.
 * Automatically backs off once the analysis reaches a terminal state.
 */
export function useMultiProjectAnalysis(candidateId, { enabled = true } = {})
{
  const query = useQuery({
    queryKey: ['multi-project-analysis', candidateId],
    queryFn: () => fetchMultiProjectAnalysis(candidateId),
    enabled: Boolean(candidateId) && enabled,
    refetchInterval: (q) => {
      const result = q.state.data;
      if (!result) return 4000;
      const status = result.overallStatus || result.analysisStatus;
      const projectsEmpty = !result.projects?.length;
      if (TERMINAL_STATUSES.includes(status) && !projectsEmpty) return false;
      return 4000;
    },
    refetchIntervalInBackground: true,
  });

  const status = query.data?.overallStatus || query.data?.analysisStatus || null;
  const isRunning = Boolean(query.data) && !TERMINAL_STATUSES.includes(status);

  return {
    ...query,
    status,
    isRunning,
  };
}

/** Imperative trigger to start/refresh polling right after an upload completes. */
export function useInvalidateMultiProjectAnalysis()
{
  const queryClient = useQueryClient();
  return useCallback((candidateId) => {
    queryClient.invalidateQueries({ queryKey: ['multi-project-analysis', candidateId] });
  }, [queryClient]);
}
