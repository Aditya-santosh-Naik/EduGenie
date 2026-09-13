import { useCallback } from 'react';
import { useSessionStore } from '../store/sessionStore';
import { useGamificationStore } from '../store/gamificationStore';
import { useUserStore } from '../store/userStore';
import { streamExplanation } from '../lib/api';
import { db } from '../lib/db';
import { useOffline } from './useOffline';

/**
 * There is one GPU, so there is one explanation in flight at a time. useExplain
 * is mounted in several components at once (the search form, the explanation
 * card, the mood companion), and a ref inside the hook would give each of them
 * its own controller — so a second trigger would start a second generation that
 * simply queues behind the first on the VRAM lock, leaving the student staring
 * at a blank card for twice as long. Module scope is what makes "cancel the
 * previous one" actually mean the previous one, whoever started it.
 */
let inFlight: AbortController | null = null;

export function useExplain() {
  const {
    currentTopic, mode, level, isLoading,
    setLoading, setStreamedText, appendStreamedText,
    setExplanation, resetRetry
  } = useSessionStore();
  const { addXP, recordTopic } = useGamificationStore();
  const { userId } = useUserStore();
  const isOffline = useOffline();

  const explain = useCallback(
    async (topic?: string) => {
      const topicToUse = topic || currentTopic;
      if (!topicToUse.trim()) return;

      // Cancel whatever is already running before starting another.
      inFlight?.abort();
      const controller = new AbortController();
      inFlight = controller;

      setLoading(true);
      setStreamedText('');
      setExplanation(null as unknown as Record<string, unknown>);
      resetRetry();

      // Offline mode interception
      if (isOffline) {
        try {
          const cached = await db.offlineCache
            .where('[topic+mode+level]')
            .equals([topicToUse, mode, level])
            .first();

          if (cached) {
            const parsed = JSON.parse(cached.response);
            setExplanation(parsed);
            setStreamedText(parsed.explanationText || 'Cached content loaded.');
            setLoading(false);
            return;
          } else {
            setExplanation({ error: 'You are offline and this topic is not in your local cache. Please reconnect to the internet.' } as Record<string, unknown>);
            setLoading(false);
            return;
          }
        } catch (err) {
          console.error('Offline cache read error:', err);
        }
      }

      let fullText = '';
      let lastUpdate = Date.now();
      // Visual aids arrive as their own event — the small local model does not
      // return them inside the main JSON.
      let extras: Extras | null = null;

      try {
        for await (const event of streamExplanation(
          topicToUse,
          mode,
          level,
          userId,
          controller.signal
        )) {
          if (event.type === 'token') {
            fullText += event.data;
            if (Date.now() - lastUpdate > 50) {
              setStreamedText(fullText);
              lastUpdate = Date.now();
            }
          } else if (event.type === 'error') {
            // Backend sent an explicit error event
            try {
              const errData = JSON.parse(event.data);
              setExplanation({ error: errData.error || 'An error occurred' } as Record<string, unknown>);
            } catch {
              setExplanation({ error: event.data } as Record<string, unknown>);
            }
            setLoading(false);
            return;
          } else if (event.type === 'extras') {
            try {
              extras = JSON.parse(event.data);
            } catch { /* non-critical */ }
          } else if (event.type === 'youtube') {
            try {
              const ytData = JSON.parse(event.data);
              useSessionStore.setState((s) => ({
                explanation: { ...(s.explanation || {}), _youtube: ytData.youtube }
              }));
            } catch { /* non-critical */ }
          } else if (event.type === 'done') {
            break;
          }
        }

        // Parse the complete JSON response
        if (fullText.trim()) {
          const cleanText = fullText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          try {
            const parsed = JSON.parse(cleanText);
            normalizeExplanationText(parsed);
            mergeExtras(parsed, extras, topicToUse, level as Level);
            setExplanation(parsed);
            addXP(50);
            recordTopic(topicToUse);

            // Update Knowledge Graph
            const nodeId = topicToUse.toLowerCase();
            const existingNode = await db.graphNodes.get(nodeId);
            await db.graphNodes.put({
              id: nodeId,
              topic: topicToUse,
              masteryScore: existingNode ? existingNode.masteryScore + 10 : 10,
              studiedAt: new Date()
            });

            if (parsed.prerequisites?.topics) {
              for (const prereq of parsed.prerequisites.topics) {
                const prereqId = prereq.toLowerCase();
                // Ensure prerequisite node exists
                const existingPrereq = await db.graphNodes.get(prereqId);
                if (!existingPrereq) {
                  await db.graphNodes.put({
                    id: prereqId,
                    topic: prereq,
                    masteryScore: 0,
                    studiedAt: new Date()
                  });
                }
                
                // Add edge
                const edgeExists = await db.graphEdges
                  .where({ source: prereqId, target: nodeId })
                  .first();
                  
                if (!edgeExists) {
                  await db.graphEdges.put({
                    source: prereqId,
                    target: nodeId,
                    type: 'prerequisite'
                  });
                }
              }
            }

            // Save to Offline Cache
            if (!isOffline) {
              await db.offlineCache.put({
                topic: topicToUse,
                mode,
                level,
                response: cleanText,
                savedAt: Date.now()
              });

              // Enforce 10 item capacity
              const count = await db.offlineCache.count();
              if (count > 10) {
                const oldest = await db.offlineCache.orderBy('savedAt').first();
                if (oldest?.id) await db.offlineCache.delete(oldest.id);
              }
            }

          } catch {
            setExplanation({ explanationText: fullText, _raw: true } as Record<string, unknown>);
          }
        }
      } catch (err) {
        // A superseded request is not a failure — the newer one owns the UI now.
        if (err instanceof DOMException && err.name === 'AbortError') return;
        const message = err instanceof Error ? err.message : 'Unknown error';
        setExplanation({ error: message } as Record<string, unknown>);
      } finally {
        if (inFlight === controller) {
          inFlight = null;
          setLoading(false);
        }
      }
    },
    [currentTopic, mode, level, userId, setLoading, setStreamedText, appendStreamedText, setExplanation, resetRetry, addXP, recordTopic, isOffline]
  );

  const cancel = useCallback(() => {
    inFlight?.abort();
    inFlight = null;
    setLoading(false);
  }, [setLoading]);

  return { explain, cancel, isLoading };
}

/**
 * The schema asks for `explanationText` as one markdown string, but a small
 * model sometimes returns the sections as a nested object or an array instead —
 * `{"Introduction": "...", "## Key Concepts": "..."}`. The renderer splits the
 * value on newlines, so anything but a string renders blank. Flatten those
 * shapes back into markdown rather than losing a perfectly good explanation.
 */
function normalizeExplanationText(parsed: Record<string, unknown>): void {
  const value = parsed.explanationText;
  if (typeof value === 'string' || value == null) return;

  const sectionsOf = (input: unknown): string[] => {
    if (typeof input === 'string') return [input];

    if (Array.isArray(input)) {
      return input.flatMap(sectionsOf);
    }

    if (typeof input === 'object') {
      return Object.entries(input as Record<string, unknown>).flatMap(([key, body]) => {
        const text = sectionsOf(body).join('\n\n');
        if (!text.trim()) return [];
        // Keys are section titles; keep any ## the model already supplied.
        const heading = key.trim().startsWith('#') ? key.trim() : `## ${key.trim()}`;
        return [`${heading}\n${text}`];
      });
    }

    return [];
  };

  const markdown = sectionsOf(value).join('\n\n').trim();
  if (markdown) parsed.explanationText = markdown;
}

/**
 * Folds the separately-generated visual aids into the explanation object, and
 * makes sure the images are actually reachable: ExplanationCard only renders an
 * image where an [IMAGE_PLACEHOLDER_id] marker appears in the text, and the
 * model routinely omits those markers. When they are missing we append one per
 * image so the generated diagrams still show up.
 */
function mergeExtras(
  parsed: Record<string, unknown>,
  extras: Extras | null,
  topic: string,
  level: Level
): void {
  if (!parsed.images && extras?.images?.length) parsed.images = extras.images;
  if (!parsed.diagram && extras?.diagram) parsed.diagram = extras.diagram;
  if (!parsed.applications && extras?.applications?.length) {
    parsed.applications = extras.applications;
  }

  // The learning path must never be empty — a student should always have a
  // next move. Model suggestions come first; a deeper pass at the same topic
  // is appended as a guaranteed fallback.
  parsed.nextSteps = withDeeperStep(extras?.nextSteps ?? [], topic, level);

  if (!extras) return;

  const images = parsed.images as Array<{ id: string }> | undefined;
  const text = parsed.explanationText;
  if (!images?.length || typeof text !== 'string') return;
  if (text.includes('[IMAGE_PLACEHOLDER_')) return;

  const markers = images.map((i) => `[IMAGE_PLACEHOLDER_${i.id}]`).join('\n');
  parsed.explanationText = `${text.trimEnd()}\n\n${markers}`;
}

export type Level = 'beginner' | 'intermediate' | 'advanced';

export interface LearningStep {
  title: string;
  topic: string;
  level: Level;
  why: string;
}

interface Extras {
  images?: Array<{ id: string; prompt: string }>;
  diagram?: { type: string; code: string } | null;
  applications?: string[];
  nextSteps?: LearningStep[];
}

const NEXT_LEVEL: Record<Level, Level | null> = {
  beginner: 'intermediate',
  intermediate: 'advanced',
  advanced: null
};

/** Guarantees a "go deeper on this topic" step unless already at advanced. */
function withDeeperStep(steps: LearningStep[], topic: string, level: Level): LearningStep[] {
  const deeper = NEXT_LEVEL[level];
  const alreadyDeeper = steps.some(
    (s) => s.topic.trim().toLowerCase() === topic.trim().toLowerCase()
  );

  if (!deeper || alreadyDeeper) return steps.slice(0, 4);

  return [
    ...steps.slice(0, 3),
    {
      title: `Go deeper: ${topic} (${deeper})`,
      topic,
      level: deeper,
      why: `You've covered the ${level} level — take the same topic further.`
    }
  ];
}
