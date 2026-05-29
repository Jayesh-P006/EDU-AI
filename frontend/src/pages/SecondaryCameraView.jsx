import {useEffect, useRef} from 'react';
import {useSearchParams} from 'react-router-dom';
import SecondaryCamera from '../components/SecondaryCamera';

function SecondaryCameraView()
{
    const [searchParams]=useSearchParams();
    const code=searchParams.get('code');
    const wakeLockRef=useRef(null);

    useEffect(() =>
    {
        if (!code)
        {
            return;
        }

        // Prevent device from sleeping
        const requestWakeLock=async () =>
        {
            if ('wakeLock' in navigator)
            {
                try
                {
                    wakeLockRef.current=await navigator.wakeLock.request('screen');
                    console.log('[SecondaryCam] Wake lock acquired');

                    // Re-acquire wake lock if released (e.g., tab switch)
                    wakeLockRef.current.addEventListener('release', () =>
                    {
                        console.log('[SecondaryCam] Wake lock released, re-acquiring...');
                        requestWakeLock();
                    });
                } catch (err)
                {
                    console.warn('Wake lock failed:', err);
                }
            }
        };
        requestWakeLock();

        // Re-acquire wake lock when page becomes visible again
        const handleVisibilityChange=() =>
        {
            if (document.visibilityState==='visible')
            {
                requestWakeLock();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () =>
        {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            if (wakeLockRef.current)
            {
                wakeLockRef.current.release().catch(() => {});
            }
        };
    }, [code]);

    if (!code)
    {
        return (
            <div style={{padding: '20px', textAlign: 'center', color: '#fff', background: '#111', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
                <h2>Invalid Connection</h2>
                <p>Please scan the QR code from the interview screen.</p>
            </div>
        );
    }

    return <SecondaryCamera isPhone={true} />;
}

export default SecondaryCameraView;
