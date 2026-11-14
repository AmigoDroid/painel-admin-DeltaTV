import { useEffect, useRef } from "react";
const KEY = "deltatv.task-intent.v1";
const TTL_MS = 15000;
export function enqueueTaskIntent(task) {
  if (!task?.actionId || !task.route) return;
  const intent = { actionId: task.actionId, route: task.route, createdAt: Date.now() };
  try { sessionStorage.setItem(KEY, JSON.stringify(intent)); } catch { return; }
  window.dispatchEvent(new CustomEvent("deltatv-task-intent", { detail: intent }));
}
export function consumeTaskIntent(route, actionId) {
  let item;
  try { item = JSON.parse(sessionStorage.getItem(KEY) || "null"); } catch { return false; }
  if (!item || Date.now() - item.createdAt > TTL_MS) {
    try { sessionStorage.removeItem(KEY); } catch {} return false;
  }
  if (item.route !== route || item.actionId !== actionId) return false;
  try { sessionStorage.removeItem(KEY); } catch {}
  return true;
}
/** Consumido pela página real no primeiro render e quando uma nova busca escolhe a mesma página. */
export function useTaskIntent(route, actionId, callback) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  useEffect(() => {
    const check = () => { if (consumeTaskIntent(route, actionId)) callbackRef.current(); };
    window.addEventListener("deltatv-task-intent", check);
    check();
    return () => window.removeEventListener("deltatv-task-intent", check);
  }, [route, actionId]);
}
