import {createContext, useContext, useState, useEffect, useCallback} from 'react';
import api from '../services/api';

const FeatureContext=createContext({features: {}, loading: true, refresh: () => {}});

/**
 * FeatureProvider – fetches the feature config for the current user's role
 * and exposes it via context so any child can call useFeature(id).
 *
 * Usage:
 *   <FeatureProvider role="company">
 *     <CompanyDashboard />
 *   </FeatureProvider>
 */
export function FeatureProvider({role, children})
{
  const [features, setFeatures]=useState({});
  const [loading, setLoading]=useState(true);

  const fetchFeatures=useCallback(async () =>
  {
    if (!role||!['company', 'student'].includes(role)) {setLoading(false); return;}

    try
    {
      const res=await api.get(`/feature-config/${role}`);
      setFeatures(res.data?.features||{});
    } catch (err)
    {
      console.warn('[FeatureProvider] Failed to fetch features, defaulting to all-enabled:', err.message);
      setFeatures({}); // Empty = all enabled (see useFeature logic)
    } finally
    {
      setLoading(false);
    }
  }, [role]);

  useEffect(() =>
  {
    fetchFeatures();
  }, [fetchFeatures]);

  return (
    <FeatureContext.Provider value={{features, loading, refresh: fetchFeatures}}>
      {children}
    </FeatureContext.Provider>
  );
}

/**
 * useFeature(featureId) → boolean
 *
 * Returns true if the feature is enabled (or if the feature is not
 * explicitly set in the config — i.e. opt-out model, not opt-in).
 */
export function useFeature(featureId)
{
  const {features}=useContext(FeatureContext);

  // If the feature ID is explicitly set to false → disabled
  // Otherwise (true, undefined, not present) → enabled
  if (features[featureId]===false) return false;
  return true;
}

/**
 * useFeatures() → {features, loading, refresh}
 * Returns the raw context for more advanced use cases.
 */
export function useFeatures()
{
  return useContext(FeatureContext);
}

export default FeatureContext;
