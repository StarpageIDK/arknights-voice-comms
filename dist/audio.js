export function createAudioPlayer(
  audio,
  {
    fetchAudio = (...args) => fetch(...args),
    urls = URL,
    onReady = () => {},
    onError = () => {},
    timeout = 20000,
  } = {},
) {
  let path = "",
    ready,
    generation = 0,
    playback = 0,
    cancel;
  const clips = new Map();
  function stop() {
    playback++;
    audio.pause();
  }
  function clear() {
    stop();
    generation++;
    cancel?.();
    audio.onloadedmetadata = null;
    audio.onerror = null;
    path = "";
    ready = null;
    audio.removeAttribute?.("src");
    audio.load();
    for (const clip of clips.values())
      clip.then((url) => urls.revokeObjectURL(url)).catch(() => {});
    clips.clear();
  }
  function load(nextPath) {
    if (path === nextPath && ready) return ready;
    stop();
    cancel?.();
    path = nextPath;
    const current = ++generation;
    const controller = new AbortController();
    ready = new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (current === generation) {
          audio.onloadedmetadata = null;
          audio.onerror = null;
        }
        error ? reject(error) : resolve(value);
      };
      const timer = setTimeout(() => {
        controller.abort();
        finish(Error("Audio timed out"));
      }, timeout);
      cancel = () => {
        if (settled) return;
        controller.abort();
        const clip = clips.get(nextPath);
        clips.delete(nextPath);
        clip?.then((url) => urls.revokeObjectURL(url)).catch(() => {});
        finish(null, false);
      };
      if (!clips.has(nextPath)) {
        const pending = fetchAudio(nextPath, { signal: controller.signal })
          .then((r) => {
            if (!r.ok) throw Error("Audio unavailable");
            return r.blob();
          })
          .then((blob) => urls.createObjectURL(blob));
        clips.set(nextPath, pending);
        pending.catch(() => {
          if (clips.get(nextPath) === pending) clips.delete(nextPath);
        });
      }
      clips
        .get(nextPath)
        .then((url) => {
          if (settled || current !== generation) return finish(null, false);
          audio.onloadedmetadata = () => {
            if (settled || current !== generation) return;
            onReady(audio.duration);
            finish(null, true);
          };
          audio.onerror = () => finish(Error("Audio decoding failed"));
          audio.src = url;
          audio.load();
        })
        .catch((error) => finish(error));
    }).catch((error) => {
      if (current === generation) {
        path = "";
        ready = null;
        const clip = clips.get(nextPath);
        clips.delete(nextPath);
        clip?.then((url) => urls.revokeObjectURL(url)).catch(() => {});
        onError(error);
      }
      return false;
    });
    return ready;
  }
  async function play(nextPath) {
    const pending = load(nextPath),
      request = ++playback;
    if (!(await pending) || request !== playback) return false;
    try {
      await audio.play();
      return request === playback;
    } catch (error) {
      if (request === playback) onError(error);
      return false;
    }
  }
  return { load, play, stop, clear };
}
