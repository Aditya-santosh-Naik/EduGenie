import { useCallback, useRef } from 'react';
import { useSessionStore } from '../store/sessionStore';
import { useGamificationStore } from '../store/gamificationStore';
import { useUserStore } from '../store/userStore';
import { streamExplanation } from '../lib/api';
import { db } from '../lib/db';
import { useOffline } from './useOffline';

export function useExplain() {
  const abortRef = useRef<AbortController | null>(null);
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

      // Cancel any in-flight request
      abortRef.current?.abort();
      abortRef.current = new AbortController();

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

      try {
        for await (const event of streamExplanation(topicToUse, mode, level, userId)) {
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
        const message = err instanceof Error ? err.message : 'Unknown error';
        setExplanation({ error: message } as Record<string, unknown>);
      } finally {
        setLoading(false);
      }
    },
    [currentTopic, mode, level, userId, setLoading, setStreamedText, appendStreamedText, setExplanation, resetRetry, addXP, recordTopic, isOffline]
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setLoading(false);
  }, [setLoading]);

  return { explain, cancel, isLoading };
}
