import { useState } from 'react';
import type { PaymentMethodKey } from '../types/trip';

interface PaymentMethodIconProps {
  method: PaymentMethodKey;
  className?: string;
}

export function PaymentMethodIcon({ method, className = 'h-10 w-10' }: PaymentMethodIconProps) {
  const [imgError, setImgError] = useState(false);
  const baseUrl = import.meta.env.BASE_URL;

  if (method === 'instapay') {
    if (!imgError) {
      return (
        <span
          className={`inline-flex items-center justify-center overflow-hidden rounded-xl border border-[#E4DDD2] bg-white p-1 ${className}`}
        >
          <img
            src={`${baseUrl}assets/aistudio/image_8516821c.png`}
            alt="إنستا باي - InstaPay"
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="h-full w-full object-contain"
          />
        </span>
      );
    }
    return (
      <svg
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-hidden="true"
      >
        <rect width="48" height="48" rx="12" fill="#4E2A84" />
        <path
          d="M14 15H22.5C25.5 15 27.5 16.8 27.5 19.6C27.5 22.4 25.5 24.2 22.5 24.2H18.2V33H14V15ZM18.2 20.9H21.9C23.1 20.9 23.8 20.3 23.8 19.5C23.8 18.7 23.1 18.1 21.9 18.1H18.2V20.9Z"
          fill="#FFFFFF"
        />
        <path
          d="M32.2 14.5L26.8 25.2H31.3L28.6 34.5L36.8 22.4H31.8L34.7 14.5H32.2Z"
          fill="#F58220"
        />
      </svg>
    );
  }

  if (method === 'orange') {
    if (!imgError) {
      return (
        <span
          className={`inline-flex items-center justify-center overflow-hidden rounded-xl border border-[#E4DDD2] bg-white p-1 ${className}`}
        >
          <img
            src={`${baseUrl}assets/aistudio/image_978de071.png`}
            alt="أورانج كاش - Orange Cash"
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="h-full w-full object-contain"
          />
        </span>
      );
    }
    return (
      <svg
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-hidden="true"
      >
        <rect width="48" height="48" rx="12" fill="#FF7900" />
        <rect x="9" y="33" width="30" height="5" rx="1.5" fill="#FFFFFF" />
        <path
          d="M24 11C18.5 11 14.5 14.9 14.5 20.2C14.5 25.5 18.5 29.4 24 29.4C29.5 29.4 33.5 25.5 33.5 20.2C33.5 14.9 29.5 11 24 11ZM24 25.4C20.9 25.4 18.8 23.2 18.8 20.2C18.8 17.2 20.9 15 24 15C27.1 15 29.2 17.2 29.2 20.2C29.2 23.2 27.1 25.4 24 25.4Z"
          fill="#111111"
        />
      </svg>
    );
  }

  // Vodafone Cash
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect width="48" height="48" rx="12" fill="#E60000" />
      <circle cx="24" cy="24" r="14" fill="#FFFFFF" />
      <path
        d="M24.2 13.5C19.5 13.8 15.8 17.8 15.8 22.9C15.8 27.9 19.6 31.8 24.4 31.8C28.8 31.8 32.1 28.5 32.1 24.4C32.1 20.5 29.2 17.7 25.5 17.7C24.5 17.7 23.7 17.9 23.1 18.2C23.5 15.9 25.1 14.3 27.2 13.7C26.2 13.5 25.2 13.4 24.2 13.5Z"
        fill="#E60000"
      />
    </svg>
  );
}
