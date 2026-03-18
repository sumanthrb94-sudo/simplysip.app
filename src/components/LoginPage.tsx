import GoogleLoginButton from './GoogleLoginButton';

interface LoginPageProps {
  onLoginSuccess: (user: any) => void;
}

const LoginPage = ({ onLoginSuccess }: LoginPageProps) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#F5F2ED]">
      <div className="text-center mb-8">
        <h1 className="text-5xl font-bold text-[#1A1A1A] drop-shadow-lg">SimplySip</h1>
        <p className="text-lg text-[#6B4F4B] mt-2">Your daily dose of happiness, just a sip away.</p>
      </div>
      <div className="mt-8">
        <GoogleLoginButton onLoginSuccess={onLoginSuccess} />
      </div>
    </div>
  );
};

export default LoginPage;
