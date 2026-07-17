const debounceMap = new Map();

const triggerSync = (key, fn, delay = 3000) => {
  if (debounceMap.has(key)) return;

  const timeout = setTimeout(async () => {
    await fn();
    debounceMap.delete(key);
  }, delay);

  debounceMap.set(key, timeout);
};

module.exports = { triggerSync };
