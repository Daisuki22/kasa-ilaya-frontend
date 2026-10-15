import { Toaster as SonnerToaster } from 'sonner';

export function Toaster(props) {
  return (
    <SonnerToaster
      position="top-center"
      offset={{ top: '6rem' }}
      mobileOffset={{ top: '6rem' }}
      {...props}
    />
  );
}
