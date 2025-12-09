import React, { useEffect, useState, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { googleLogin } from '../redux/authSlice';
import './GoogleSignIn.css';

const GoogleSignIn = ({ buttonText = "Sign in with Google", onSuccess, onError }) => {
  const dispatch = useDispatch();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const buttonRef = useRef(null);
  const initAttempts = useRef(0);

  useEffect(() => {
    let mounted = true;

    // Check for Google Client ID
    const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;
    
    if (!clientId) {
      console.error('❌ REACT_APP_GOOGLE_CLIENT_ID is not defined in .env file');
      setError('Google Sign-In is not configured. Please add REACT_APP_GOOGLE_CLIENT_ID to .env file');
      setIsLoading(false);
      return;
    }

    console.log('✅ Google Client ID found:', clientId.substring(0, 20) + '...');

    // Load and initialize
    const loadAndInitialize = () => {
      // Check if script already loaded
      if (window.google) {
        console.log('✅ Google SDK already loaded');
        if (mounted) {
          // Wait a bit for React to render the button div
          setTimeout(() => initializeGoogleSignIn(), 100);
        }
        return;
      }

      // Load Google Sign-In script
      console.log('📦 Loading Google SDK...');
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      
      script.onload = () => {
        console.log('✅ Google SDK loaded successfully');
        if (mounted && window.google) {
          // Wait for React to render
          setTimeout(() => initializeGoogleSignIn(), 100);
        }
      };

      script.onerror = () => {
        console.error('❌ Failed to load Google SDK');
        if (mounted) {
          setError('Failed to load Google Sign-In. Please check your internet connection and refresh the page.');
          setIsLoading(false);
          if (onError) {
            onError('Failed to load Google Sign-In script');
          }
        }
      };

      document.body.appendChild(script);
    };

    loadAndInitialize();

    // Cleanup
    return () => {
      mounted = false;
    };
  }, [onError]);

  const initializeGoogleSignIn = () => {
    const buttonDiv = buttonRef.current;
    
    if (!buttonDiv) {
      console.error('❌ Button ref not available');
      initAttempts.current++;
      
      if (initAttempts.current < 5) {
        console.log('⏳ Retrying initialization... Attempt:', initAttempts.current);
        setTimeout(() => initializeGoogleSignIn(), 200);
        return;
      }
      
      setError('Failed to render Google button after multiple attempts');
      setIsLoading(false);
      return;
    }

    try {
      const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;
      
      console.log('🔧 Initializing Google Sign-In...');

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      console.log('🎨 Rendering Google button...');
      // Get the parent container width to ensure button matches login button width
      const parentWidth = buttonDiv.parentElement?.offsetWidth || buttonDiv.offsetWidth || 400;
      
      window.google.accounts.id.renderButton(
        buttonDiv,
        {
          theme: 'outline',
          size: 'large',
          width: parentWidth,
          text: 'continue_with',
          shape: 'rectangular',
          logo_alignment: 'left',
        }
      );
      console.log('✅ Google button rendered successfully');
      setIsLoading(false);
      setError(null);
    } catch (error) {
      console.error('❌ Error initializing Google Sign-In:', error);
      setError('Failed to initialize Google Sign-In: ' + error.message);
      setIsLoading(false);
      if (onError) {
        onError('Failed to initialize Google Sign-In');
      }
    }
  };

  const handleCredentialResponse = async (response) => {
    console.log('📝 Received credential response');
    
    if (!response.credential) {
      console.error('❌ No credential in response');
      if (onError) {
        onError('Failed to get Google credentials');
      }
      return;
    }

    console.log('🔐 Credential received, logging in...');
    console.log('🔑 Token preview:', response.credential.substring(0, 50) + '...');

    try {
      // Dispatch Redux action for Google login
      const resultAction = await dispatch(googleLogin(response.credential));
      console.log('📨 Login result action:', resultAction);
      
      if (googleLogin.fulfilled.match(resultAction)) {
        const result = resultAction.payload;
        console.log('✅ Login successful, payload:', result);
        
        // Check if account is locked
        if (result?.isAccountLocked) {
          const errorMessage = result.message || 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên để được hỗ trợ.';
          console.error('❌ Account is locked:', errorMessage);
          if (onError) {
            onError(errorMessage);
          }
          return;
        }
        
        if (onSuccess) {
          // Pass user data to parent component
          onSuccess(result?.data?.user || result?.user);
        }
      } else {
        const errorMessage = resultAction.payload || 'Login failed. Please try again.';
        console.error('❌ Login failed:', errorMessage);
        if (onError) {
          onError(errorMessage);
        }
      }
    } catch (error) {
      console.error('❌ Google Sign-In Error:', error);
      if (onError) {
        onError(error.message || 'Failed to sign in with Google');
      }
    }
  };

  if (error) {
    return (
      <div className="google-signin-error">
        <div className="error-message">{error}</div>
        <button 
          className="retry-button"
          onClick={() => {
            setError(null);
            setIsLoading(true);
            initAttempts.current = 0;
            window.location.reload();
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="google-signin-wrapper">
      {isLoading ? (
        <div className="google-signin-loading">
          Loading Google Sign-In...
        </div>
      ) : null}
      <div ref={buttonRef} style={{ width: '100%' }}></div>
    </div>
  );
};

export default GoogleSignIn;