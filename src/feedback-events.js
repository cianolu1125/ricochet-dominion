// Fact instrumentation only. It never decides or changes a game rule.
let sequence = 0;
export const feedbackId = () => `feedback-${++sequence}`;
export function fact(s, event) {
  const eventId = feedbackId();
  const f = {
    owner: s.current,
    ...event,
    eventId,
    groupId: event.groupId || s.feedbackGroup || eventId,
  };
  (s.feedbackFacts ||= []).push(f);
  return f;
}
export function drainFacts(s) {
  const facts = s.feedbackFacts || [];
  s.feedbackFacts = [];
  return facts;
}
