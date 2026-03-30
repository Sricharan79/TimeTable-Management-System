export const MASTER_DATA_SYNC_KEY = 'tts-master-data-version';
export const MASTER_DATA_UPDATED_EVENT = 'master-data-updated';

export const notifyMasterDataChanged = () => {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  try {
    window.localStorage.setItem(MASTER_DATA_SYNC_KEY, stamp);
  } catch (error) {
    // Ignore localStorage errors; same-tab event still updates listeners.
  }

  window.dispatchEvent(
    new CustomEvent(MASTER_DATA_UPDATED_EVENT, {
      detail: { stamp }
    })
  );
};
