export function normalizeTask(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, " ").trim();
}
export function matchTasks(tasks, query) {
  const words = normalizeTask(query).split(" ").filter(Boolean);
  if (!words.length) return tasks;
  return tasks.filter(task => {
    const searchable = normalizeTask([task.label, task.description, ...(task.keywords || [])].join(" "));
    return words.every(word => searchable.includes(word));
  });
}
